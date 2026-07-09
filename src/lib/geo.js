// Pure geo math shared between the browser app and the Node ingest script.
import { ROUTE_POINTS, ROUTE_MILES } from '../data/route.js'

const EARTH_RADIUS_MI = 3958.8

export function toRad(deg) {
  return (deg * Math.PI) / 180
}

export function haversineMiles(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(a))
}

/** Initial compass bearing in degrees (0-360) from point 1 to point 2. */
export function bearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2))
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1))
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360
}

export function bearingToCompass(deg) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}

/**
 * Find the closest point on the route polyline to (lat, lon).
 * Returns { routeMile, distMiles } — the along-route mile of the nearest
 * point, and the perpendicular (straight-line) distance to it.
 * O(n) scan over ROUTE_POINTS; fine for a few hundred points.
 */
export function nearestOnRoute(lat, lon) {
  let best = { dist: Infinity, index: 0 }
  for (let i = 0; i < ROUTE_POINTS.length; i++) {
    const p = ROUTE_POINTS[i]
    const d = haversineMiles(lat, lon, p.lat, p.lon)
    if (d < best.dist) best = { dist: d, index: i }
  }
  return { routeMile: ROUTE_MILES[best.index], distMiles: best.dist }
}
