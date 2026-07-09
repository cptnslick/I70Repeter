#!/usr/bin/env node
// Phase A ingest: data/raw/repeaterbook-export.csv -> src/data/repeaters.json
//
// Usage:
//   node scripts/ingest.js              build repeaters.json
//   node scripts/ingest.js --headers    just print the CSV's column headers and exit
//                                       (run this first against the real export to
//                                       confirm/adjust the COLUMN_MAP below)
//
// RepeaterBook's personal-use CSV export column names vary slightly by export
// type (route search vs proximity search). COLUMN_MAP below lists the
// candidate header names we'll try, case-insensitively, for each field.
// If the real export uses different headers, add them to the candidate lists.
//
// Research overrides: manually/AI-researched club activity data
// (data/research-overrides.json, keyed by repeater id) is merged on top of
// the CSV-derived record before scoring, so re-running ingest never loses
// research work.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import Papa from 'papaparse'
import { nearestOnRoute } from '../src/lib/geo.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CSV_PATH = join(ROOT, 'data/raw/repeaterbook-export.csv')
const OVERRIDES_PATH = join(ROOT, 'data/research-overrides.json')
const OUT_PATH = join(ROOT, 'src/data/repeaters.json')

// Repeaters farther than this from the route line are dropped (perpendicular
// distance in miles). Keeps the dataset to corridor-relevant machines.
const MAX_ROUTE_DIST_MILES = 20

const COLUMN_MAP = {
  id: ['Repeater ID', 'ID', 'Rptr ID'],
  callsign: ['Callsign', 'Call Sign', 'Call'],
  frequency: ['Frequency', 'Output Freq', 'Output Frequency'],
  inputFrequency: ['Input Freq', 'Input Frequency', 'Uplink Freq'],
  pl: ['PL', 'PL Tone', 'CTCSS', 'Uplink Tone'],
  tsq: ['TSQ', 'Downlink Tone', 'DTone'],
  location: ['Nearest City', 'Location', 'Landmark'],
  county: ['County'],
  state: ['State'],
  use: ['Use'],
  status: ['Operational Status', 'Status'],
  sponsor: ['Sponsor', 'Club', 'Trustee'],
  lat: ['Lat', 'Latitude'],
  lon: ['Long', 'Lon', 'Longitude'],
  echolink: ['EchoLink Node', 'EchoLink'],
  irlp: ['IRLP Node', 'IRLP'],
  allstar: ['AllStar Node', 'AllStar'],
  wires: ['Wires Node', 'Wires', 'YSF'],
  fmBandwidth: ['FM Bandwidth'],
  dmr: ['DMR'],
  dstar: ['D-Star', 'DStar'],
  nxdn: ['NXDN'],
  p25: ['P25', 'P-25'],
  fusion: ['Fusion', 'System Fusion'],
  lastUpdate: ['Last Update', 'Last Updated', 'Update Date'],
  notes: ['Notes', 'Comments'],
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

function loadCsv() {
  if (!existsSync(CSV_PATH)) {
    console.error(`Missing ${CSV_PATH}`)
    console.error('Run a RepeaterBook highway/route search for I-70 (MD -> OH) plus the')
    console.error('I-76 PA Turnpike segment, export CSV, and drop it at that path.')
    process.exit(1)
  }
  const raw = readFileSync(CSV_PATH, 'utf-8')
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true })
  if (parsed.errors.length) {
    console.warn(`CSV parse warnings (${parsed.errors.length}):`, parsed.errors.slice(0, 5))
  }
  return parsed
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
  // Standard offset fallback by band convention.
  return band === '2m' ? -0.6 : -5.0
}

function isOperational(statusRaw) {
  if (!statusRaw) return true // unknown status -> keep, don't silently drop
  const s = statusRaw.trim().toLowerCase()
  return s.includes('on-air') || s === 'on air' || s === 'operational' || s === 'active'
}

function isAnalogFm(row, cols) {
  // If RepeaterBook flags a digital-only mode and no analog/FM indication, skip.
  const digitalFlags = ['dmr', 'dstar', 'nxdn', 'p25', 'fusion'].map((f) => row[cols[f]])
  const allDigitalBlank = digitalFlags.every((v) => !v || v.trim() === '')
  return allDigitalBlank || (row[cols.fmBandwidth] && row[cols.fmBandwidth].trim() !== '')
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
  // The remaining ~65 points (club site, Facebook, nets, trustee/newsletter
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
  const { data, meta } = loadCsv()
  const headers = meta.fields ?? []

  if (process.argv.includes('--headers')) {
    console.log('CSV headers found:')
    headers.forEach((h) => console.log(`  - ${h}`))
    return
  }

  const { resolved: cols, missing } = resolveColumns(headers)
  if (missing.length) {
    console.warn(`Warning: could not match columns for: ${missing.join(', ')}`)
    console.warn('Run with --headers to see actual CSV column names and update COLUMN_MAP.')
  }

  const seen = new Set()
  const records = []

  for (const row of data) {
    const freq = parseFloat(row[cols.frequency])
    if (!Number.isFinite(freq)) continue
    const band = toBand(freq)
    if (!band) continue
    if (!isOperational(row[cols.status])) continue
    if (!isAnalogFm(row, cols)) continue

    const lat = parseFloat(row[cols.lat])
    const lon = parseFloat(row[cols.lon])
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue

    const inputFreq = parseFloat(row[cols.inputFrequency])
    const offset = computeOffset(freq, inputFreq, band)

    const callsign = (row[cols.callsign] || '').trim()
    const dedupeKey = `${callsign}-${freq}-${lat.toFixed(3)}-${lon.toFixed(3)}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    const { routeMile, distMiles } = nearestOnRoute(lat, lon)
    if (distMiles > MAX_ROUTE_DIST_MILES) continue

    const idSource = row[cols.id] || dedupeKey
    records.push({
      id: `rb-${String(idSource).replace(/\W+/g, '').slice(0, 24) || records.length}`,
      callsign,
      freq,
      offset,
      tone_in: (row[cols.pl] || '').trim() || null,
      tone_out: (row[cols.tsq] || '').trim() || null,
      band,
      lat,
      lon,
      city: (row[cols.location] || '').trim(),
      state: (row[cols.state] || '').trim(),
      county: (row[cols.county] || '').trim(),
      club: (row[cols.sponsor] || '').trim() || null,
      club_url: null,
      score: 0,
      evidence: [],
      net_times: [],
      echolink: (row[cols.echolink] || '').trim() || null,
      allstar: (row[cols.allstar] || '').trim() || null,
      irlp: (row[cols.irlp] || '').trim() || null,
      wires: (row[cols.wires] || '').trim() || null,
      last_verified: (row[cols.lastUpdate] || '').trim() || null,
      rb_url: cols.id ? `https://www.repeaterbook.com/repeaters/details.php?id=${row[cols.id]}` : null,
      route_mile: Math.round(routeMile * 10) / 10,
      route_dist_mi: Math.round(distMiles * 10) / 10,
    })
  }

  records.sort((a, b) => a.route_mile - b.route_mile)
  const scored = mergeOverrides(records)

  if (!existsSync(dirname(OUT_PATH))) mkdirSync(dirname(OUT_PATH), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(scored, null, 2) + '\n')
  console.log(`Wrote ${scored.length} repeaters to ${OUT_PATH}`)

  const researched = scored.filter((r) => r.evidence.length > 0).length
  console.log(`${researched}/${scored.length} have research-overrides evidence.`)
  if (researched < scored.length) {
    console.log('Run the activity research pass and populate data/research-overrides.json,')
    console.log('then re-run this script, to fill in scores beyond the RepeaterBook-only baseline.')
  }
}

main()
