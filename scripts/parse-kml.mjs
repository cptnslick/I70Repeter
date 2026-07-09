// Parses a RepeaterBook KML export (repeaters_*.kml) into flat records with
// lat/lon, on-air status, and a RepeaterBook detail URL — fields the CSV
// export doesn't carry. Joined against the CSV in scripts/ingest.js by
// (callsign, freq, location), which RepeaterBook's own duplicate entries
// (same callsign+freq at two different sites) need to disambiguate.
import { readFileSync } from 'node:fs'

// RepeaterBook state_id -> full state name, for KML-only records (no CSV
// "State" column to fall back on). Extend as new corridor states show up.
export const STATE_ID_NAMES = {
  '08': 'Colorado',
  '17': 'Illinois',
  '18': 'Indiana',
  '20': 'Kansas',
  '24': 'Maryland',
  '39': 'Ohio',
  '42': 'Pennsylvania',
  '54': 'West Virginia',
}

export function normLocation(s) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

// KML locations are sometimes truncated to just the city (e.g. "Frederick"
// vs the CSV's "Frederick - Gambrill State Park"), so the join key is
// callsign+freq only; parse-kml consumers disambiguate multiple same-key
// entries by prefix-matching location text (see pickKmlMatch below).
export function kmlKey(callsign, freq) {
  return `${callsign.trim().toUpperCase()}|${freq.toFixed(4)}`
}

/** Pick the best KML candidate for a CSV row's location among same-callsign+freq entries. */
export function pickKmlMatch(candidates, csvLocation) {
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]
  const csvNorm = normLocation(csvLocation)
  const exact = candidates.find((c) => normLocation(c.location) === csvNorm)
  if (exact) return exact
  const prefix = candidates.find((c) => csvNorm.startsWith(normLocation(c.location)))
  if (prefix) return prefix
  return candidates[0]
}

export function parseKml(path) {
  const xml = readFileSync(path, 'utf-8')
  const records = []
  const placemarkRe = /<Placemark>([\s\S]*?)<\/Placemark>/g
  let m
  while ((m = placemarkRe.exec(xml))) {
    const block = m[1]
    const name = block.match(/<name>([^<]*)<\/name>/)?.[1]?.trim()
    const cdata = block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1]
    const coordsRaw = block.match(/<coordinates>([^<]*)<\/coordinates>/)?.[1]
    if (!name || !cdata || !coordsRaw) continue

    const lines = cdata
      .split('<br>')
      .map((l) => l.trim())
      .filter(Boolean)
    const location = lines[0]
    const freqLine = lines[1] ?? ''
    const onairLine = lines.find((l) => l.startsWith('On-air:')) ?? ''
    const detailHref = block.match(/href='([^']*)'/)?.[1]

    // freqLine looks like "146.640000- 131.8" (freq, offset sign, tone) —
    // used directly when a record has no corresponding CSV row to join.
    const freqMatch = freqLine.match(/^([\d.]+)\s*([+\-s])?\s*(\S*)/)
    if (!freqMatch) continue
    const freq = parseFloat(freqMatch[1])
    const offsetSign = freqMatch[2] ?? null
    const toneRaw = (freqMatch[3] ?? '').trim()
    const tone = !toneRaw || toneRaw.toUpperCase() === 'CSQ' ? null : toneRaw

    const [lonStr, latStr] = coordsRaw.split(',')
    const lat = parseFloat(latStr)
    const lon = parseFloat(lonStr)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue

    const onair = /On-air:\s*Yes/i.test(onairLine)

    let stateId = null
    let rbId = null
    if (detailHref) {
      const u = new URL(detailHref)
      stateId = u.searchParams.get('state_id')
      rbId = u.searchParams.get('ID')
    }

    records.push({
      callsign: name,
      location,
      freq,
      offsetSign,
      tone,
      lat,
      lon,
      onair,
      rbUrl: detailHref,
      stateId,
      rbId,
      state: STATE_ID_NAMES[stateId] ?? null,
    })
  }
  return records
}

export function buildKmlIndex(records) {
  const index = new Map()
  for (const r of records) {
    const key = kmlKey(r.callsign, r.freq)
    if (!index.has(key)) index.set(key, [])
    index.get(key).push(r)
  }
  return index
}
