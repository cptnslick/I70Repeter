#!/usr/bin/env node
// Phase A ingest: every *.csv + *.kml pair in data/raw/ -> src/data/repeaters.json
//
// Usage:
//   node scripts/ingest.js              build repeaters.json
//   node scripts/ingest.js --headers    print the CSV's column headers and exit
//
// RepeaterBook's personal-use CSV export (route/highway search) has no
// lat/lon, operational-status, or "last verified" columns. The companion
// KML export (also a personal-use download from the same search) has
// coordinates, on-air status, and a stable RepeaterBook detail-page ID —
// scripts/parse-kml.mjs parses it and this script joins the two by
// (callsign, freq, location), which is needed because RepeaterBook can
// list the same callsign+freq at two different sites (a linked system).
// All CSVs in data/raw/ are concatenated and all KMLs merged into one join
// index, so a supplemental search (e.g. to fill a route gap) is just another
// CSV+KML pair dropped in — no separate ingest step needed.
//
// Research overrides: manually/AI-researched club activity data
// (data/research-overrides.json, keyed by repeater id) is merged on top of
// the CSV+KML-derived record before scoring, so re-running ingest never
// loses research work.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import Papa from 'papaparse'
import { nearestOnRoute } from '../src/lib/geo.js'
import { parseKml, buildKmlIndex, kmlKey, pickKmlMatch } from './parse-kml.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const RAW_DIR = join(ROOT, 'data/raw')
const OVERRIDES_PATH = join(ROOT, 'data/research-overrides.json')
const OUT_PATH = join(ROOT, 'src/data/repeaters.json')

// Every CSV+KML pair in data/raw/ is ingested and merged — one pair per
// RepeaterBook search (e.g. the main I-70 route search, plus a supplemental
// search to fill a gap like the PA Turnpike segment).
function findRawFiles(ext) {
  if (!existsSync(RAW_DIR)) return []
  return readdirSync(RAW_DIR)
    .filter((f) => f.toLowerCase().endsWith(ext))
    .map((f) => join(RAW_DIR, f))
}

// Repeaters farther than this from the route line are dropped (perpendicular
// distance in miles). 15mi cleanly separates legitimate corridor sites
// (mountaintop repeaters can sit several miles off the direct highway line)
// from off-route noise like DC-suburb repeaters near the Baltimore endpoint.
const MAX_ROUTE_DIST_MILES = 15

const COLUMN_MAP = {
  callsign: ['Call', 'Callsign', 'Call Sign'],
  frequency: ['Output Freq', 'Frequency', 'Output Frequency'],
  inputFrequency: ['Input Freq', 'Input Frequency', 'Uplink Freq'],
  toneIn: ['Uplink Tone', 'PL', 'PL Tone', 'CTCSS'],
  toneOut: ['Downlink Tone', 'TSQ', 'DTone'],
  location: ['Location', 'Nearest City', 'Landmark'],
  county: ['County'],
  state: ['State'],
  modes: ['Modes'],
  digitalAccess: ['Digital Access'],
}

function findColumn(headers, candidates) {
  const norm = (s) => s.trim().toLowerCase()
  const headerSet = new Map(headers.map((h) => [norm(h), h]))
  for (const c of candidates) {
    const hit = headerSet.get(norm(c))
    if (hit) return hit
  }
  return null
}

function loadCsvs(csvPaths) {
  if (csvPaths.length === 0) {
    console.error(`No CSV files found in ${RAW_DIR}`)
    console.error('Run a RepeaterBook highway/route search for I-70 (MD -> OH) plus the')
    console.error('I-76 PA Turnpike segment, export CSV, and drop it there.')
    process.exit(1)
  }
  let rows = []
  let fields = []
  for (const path of csvPaths) {
    const raw = readFileSync(path, 'utf-8')
    const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true })
    if (parsed.errors.length) {
      console.warn(`${path}: CSV parse warnings (${parsed.errors.length}):`, parsed.errors.slice(0, 5))
    }
    if (fields.length === 0) fields = parsed.meta.fields ?? []
    rows = rows.concat(parsed.data)
  }
  return { data: rows, fields }
}

function resolveColumns(headers) {
  const resolved = {}
  const missing = []
  for (const [field, candidates] of Object.entries(COLUMN_MAP)) {
    const col = findColumn(headers, candidates)
    resolved[field] = col
    if (!col) missing.push(field)
  }
  return { resolved, missing }
}

function toBand(freqMhz) {
  if (freqMhz >= 144 && freqMhz <= 148) return '2m'
  if (freqMhz >= 420 && freqMhz <= 450) return '70cm'
  return null
}

function computeOffset(freq, inputFreq, band) {
  if (Number.isFinite(inputFreq) && Number.isFinite(freq)) {
    const diff = +(inputFreq - freq).toFixed(4)
    if (Math.abs(diff) > 0.0001) return diff
  }
  return band === '2m' ? -0.6 : -5.0
}

function cleanTone(tone) {
  const t = (tone || '').trim()
  if (!t || t.toUpperCase() === 'CSQ') return null
  if (/^D\d+$/i.test(t)) return null // digital NAC/color code, not an analog PL tone
  return t
}

function monthsSince(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
}

function verifiedScore(lastVerifiedDate) {
  const months = monthsSince(lastVerifiedDate)
  if (months === null) return 0
  if (months <= 12) return Math.round(15 * (1 - months / 12))
  return 0
}

function linkedSystemScore(record) {
  return record.echolink || record.irlp || record.allstar || record.wires ? 10 : 0
}

function baseScore(record) {
  // Deterministic portion computable from RepeaterBook data alone.
  // The remaining points (club site, Facebook, nets, trustee/newsletter
  // activity) come from the manual/AI research pass and live in
  // data/research-overrides.json — see mergeOverrides().
  return verifiedScore(record.last_verified) + linkedSystemScore(record)
}

function mergeOverrides(records) {
  let overrides = {}
  if (existsSync(OVERRIDES_PATH)) {
    overrides = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf-8'))
  }
  return records.map((r) => {
    const o = overrides[r.id]
    if (!o) return { ...r, evidence: r.evidence ?? [], score: baseScore(r) }
    const researchScore = o.score_bonus ?? 0
    return {
      ...r,
      club: o.club_name ?? r.club,
      club_url: o.club_url ?? r.club_url,
      evidence: o.evidence ?? r.evidence ?? [],
      net_times: o.net_times ?? r.net_times ?? [],
      score: Math.min(100, baseScore(r) + researchScore),
    }
  })
}

function main() {
  const csvPaths = findRawFiles('.csv')
  const kmlPaths = findRawFiles('.kml')

  if (process.argv.includes('--headers')) {
    const { fields } = loadCsvs(csvPaths)
    console.log('CSV headers found:')
    fields.forEach((h) => console.log(`  - ${h}`))
    return
  }

  const { data, fields: headers } = loadCsvs(csvPaths)
  console.log(`Loaded ${csvPaths.length} CSV file(s), ${data.length} rows total.`)

  const { resolved: cols, missing } = resolveColumns(headers)
  if (missing.length) {
    console.warn(`Warning: could not match columns for: ${missing.join(', ')}`)
    console.warn('Run with --headers to see actual CSV column names and update COLUMN_MAP.')
  }

  if (kmlPaths.length === 0) {
    console.error(`No KML files found in ${RAW_DIR}`)
    console.error('The CSV export has no lat/lon. Also export KML from the same')
    console.error('RepeaterBook search and drop it there.')
    process.exit(1)
  }
  const kmlIndex = buildKmlIndex(kmlPaths.flatMap(parseKml))
  console.log(`Loaded ${kmlPaths.length} KML file(s).`)

  const seen = new Set()
  const records = []
  let unmatched = 0

  for (const row of data) {
    const freq = parseFloat(row[cols.frequency])
    if (!Number.isFinite(freq)) continue
    const band = toBand(freq)
    if (!band) continue

    const modes = (row[cols.modes] || '').trim()
    if (!/\bFM\b/i.test(modes)) continue // not analog-FM capable

    const callsign = (row[cols.callsign] || '').trim()
    const location = (row[cols.location] || '').trim()

    const key = kmlKey(callsign, freq)
    const candidates = kmlIndex.get(key)
    const kmlEntry = candidates?.length ? pickKmlMatch(candidates, location) : null
    if (!kmlEntry) {
      unmatched++
      continue
    }
    // Consume this candidate so a second CSV row with the same callsign+freq
    // (a linked system at two sites) doesn't get matched to the same KML entry.
    candidates.splice(candidates.indexOf(kmlEntry), 1)
    if (!kmlEntry.onair) continue

    const dedupeKey = `${callsign}-${freq}-${kmlEntry.lat.toFixed(3)}-${kmlEntry.lon.toFixed(3)}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    const { routeMile, distMiles } = nearestOnRoute(kmlEntry.lat, kmlEntry.lon)
    if (distMiles > MAX_ROUTE_DIST_MILES) continue

    const inputFreq = parseFloat(row[cols.inputFrequency])
    const offset = computeOffset(freq, inputFreq, band)
    const modesUpper = modes.toUpperCase()

    records.push({
      id: kmlEntry.stateId && kmlEntry.rbId ? `rb-${kmlEntry.stateId}-${kmlEntry.rbId}` : `rb-${dedupeKey.replace(/\W+/g, '')}`,
      callsign,
      freq,
      offset,
      tone_in: cleanTone(row[cols.toneIn]),
      tone_out: cleanTone(row[cols.toneOut]),
      band,
      lat: kmlEntry.lat,
      lon: kmlEntry.lon,
      city: location,
      state: (row[cols.state] || '').trim(),
      county: (row[cols.county] || '').trim(),
      club: null,
      club_url: null,
      score: 0,
      evidence: [],
      net_times: [],
      echolink: modesUpper.includes('ECHOLINK') || null,
      allstar: modesUpper.includes('ALLSTAR') || null,
      irlp: modesUpper.includes('IRLP') || null,
      wires: (modesUpper.includes('WIRES') || modesUpper.includes('FUSION')) || null,
      last_verified: null,
      rb_url: kmlEntry.rbUrl ?? null,
      route_mile: Math.round(routeMile * 10) / 10,
      route_dist_mi: Math.round(distMiles * 10) / 10,
    })
  }

  records.sort((a, b) => a.route_mile - b.route_mile)
  // Channel number = position along the route, east (Baltimore, mile 0) to
  // west (Westerville) — doubles as the Baofeng/CHIRP memory channel number.
  records.forEach((r, i) => {
    r.channel = i + 1
  })
  const scored = mergeOverrides(records)

  if (!existsSync(dirname(OUT_PATH))) mkdirSync(dirname(OUT_PATH), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(scored, null, 2) + '\n')
  console.log(`Wrote ${scored.length} repeaters to ${OUT_PATH}`)
  if (unmatched) console.log(`${unmatched} CSV rows had no KML coordinate match (skipped).`)

  const researched = scored.filter((r) => r.evidence.length > 0).length
  console.log(`${researched}/${scored.length} have research-overrides evidence.`)
  if (researched < scored.length) {
    console.log('Run the activity research pass and populate data/research-overrides.json,')
    console.log('then re-run this script, to fill in scores beyond the RepeaterBook-only baseline.')
  }
}

main()
