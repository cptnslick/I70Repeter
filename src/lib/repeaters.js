import { haversineMiles, bearing, bearingToCompass } from './geo.js'

// Simplex-usable range guesses by band (miles). 2m propagates further than 70cm
// for a given ERP/elevation; these are rough defaults, not RF predictions.
export const BAND_RANGE_MI = { '2m': 35, '70cm': 25 }

export const SCORE_TIER = {
  green: { min: 70, color: '#22c55e' },
  yellow: { min: 40, color: '#eab308' },
  gray: { min: 0, color: '#6b7280' },
}

export function scoreTier(score) {
  if (score >= SCORE_TIER.green.min) return 'green'
  if (score >= SCORE_TIER.yellow.min) return 'yellow'
  return 'gray'
}

export function scoreColor(score) {
  return SCORE_TIER[scoreTier(score)].color
}

/** Distance (mi) and compass bearing from position to a repeater. */
export function distanceAndBearing(position, repeater) {
  const dist = haversineMiles(position.lat, position.lon, repeater.lat, repeater.lon)
  const brg = bearing(position.lat, position.lon, repeater.lat, repeater.lon)
  return { distMiles: dist, bearingDeg: brg, compass: bearingToCompass(brg) }
}

/**
 * Repeaters "ahead of and near" the current position: within band-specific
 * simplex range, and not more than 10 route-miles behind current position.
 * Sorted by route mile (closest-ahead first), returns top `limit`.
 */
export function nearbyRepeaters(repeaters, position, currentRouteMile, { limit = 5, band = 'both', minScore = 0 } = {}) {
  return repeaters
    .filter((r) => band === 'both' || r.band === band)
    .filter((r) => r.score >= minScore)
    .filter((r) => r.route_mile >= currentRouteMile - 10)
    .map((r) => ({ ...r, ...distanceAndBearing(position, r) }))
    .filter((r) => r.distMiles <= BAND_RANGE_MI[r.band])
    .sort((a, b) => a.route_mile - b.route_mile)
    .slice(0, limit)
}

/**
 * The single best-scored repeater coming into range in the next `aheadMiles`
 * route-miles (not yet within simplex range, but will be soon).
 */
export function nextUpRepeater(repeaters, position, currentRouteMile, { aheadMiles = 20, band = 'both', minScore = 0 } = {}) {
  const candidates = repeaters
    .filter((r) => band === 'both' || r.band === band)
    .filter((r) => r.score >= minScore)
    .filter((r) => r.route_mile > currentRouteMile && r.route_mile <= currentRouteMile + aheadMiles)
    .map((r) => ({ ...r, ...distanceAndBearing(position, r) }))
    .filter((r) => r.distMiles > BAND_RANGE_MI[r.band])

  if (candidates.length === 0) return null
  return candidates.sort((a, b) => b.score - a.score)[0]
}

const DOW_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** True if `now` falls within +/- windowMin of any of the repeater's net times. */
export function isNetNow(netTimes, now = new Date(), windowMin = 30) {
  if (!netTimes || netTimes.length === 0) return false
  const nowDow = DOW_NAMES[now.getDay()]
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return netTimes.some((n) => {
    if (n.dow !== 'daily' && n.dow !== nowDow) return false
    const [h, m] = n.time.split(':').map(Number)
    const netMinutes = h * 60 + m
    return Math.abs(nowMinutes - netMinutes) <= windowMin
  })
}

export function formatOffset(offset) {
  if (offset === 0) return 'Simplex'
  return offset > 0 ? `+${offset.toFixed(2)}` : offset.toFixed(2)
}

export function formatTone(tone) {
  return tone ? `PL ${tone}` : 'No tone'
}
