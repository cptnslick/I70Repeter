// Simplified route corridor: Baltimore, MD -> Westerville, OH
// via I-70 W, PA Turnpike (I-76 W) Breezewood -> New Stanton, then I-70 W, I-270 N.
// Coordinates are approximate waypoints for corridor visualization and
// route-mile math, NOT turn-by-turn navigation data.
//
// Each waypoint may carry a `label` for the nearest town/interchange.
export const ROUTE_WAYPOINTS = [
  { lat: 39.3020, lon: -76.7314, label: 'Baltimore (I-70 start / I-695)' },
  { lat: 39.3197, lon: -76.7962, label: 'Woodstock / Marriottsville' },
  { lat: 39.3406, lon: -76.8494, label: 'Woodbine' },
  { lat: 39.3574, lon: -76.9600, label: 'Sykesville exit' },
  { lat: 39.3759, lon: -77.1552, label: 'Mount Airy' },
  { lat: 39.3917, lon: -77.2814, label: 'New Market' },
  { lat: 39.4143, lon: -77.4105, label: 'Frederick' },
  { lat: 39.4854, lon: -77.5590, label: 'Myersville / South Mountain' },
  { lat: 39.5624, lon: -77.6600, label: 'Beaver Creek / Boonsboro' },
  { lat: 39.6418, lon: -77.7200, label: 'Hagerstown' },
  { lat: 39.6598, lon: -77.9204, label: 'Clear Spring' },
  { lat: 39.7018, lon: -78.1758, label: 'Hancock' },
  { lat: 39.8300, lon: -78.2200, label: 'Sideling Hill / PA line' },
  { lat: 40.0034, lon: -78.2372, label: 'Breezewood (onto PA Turnpike I-76 W)' },
  { lat: 40.0176, lon: -78.5044, label: 'Bedford (Turnpike)' },
  { lat: 40.0059, lon: -78.7900, label: 'Buckstown (Turnpike)' },
  { lat: 40.0059, lon: -79.0778, label: 'Somerset (Turnpike)' },
  { lat: 40.1090, lon: -79.3572, label: 'Donegal (Turnpike)' },
  { lat: 40.2115, lon: -79.5867, label: 'New Stanton (back onto I-70 W)' },
  { lat: 40.1006, lon: -79.8562, label: 'Belle Vernon' },
  { lat: 40.1734, lon: -80.2462, label: 'Washington, PA' },
  { lat: 40.1023, lon: -80.4185, label: 'Claysville' },
  { lat: 40.0790, lon: -80.5190, label: 'West Virginia line' },
  { lat: 40.0640, lon: -80.7209, label: 'Wheeling, WV' },
  { lat: 40.0806, lon: -80.9034, label: 'St. Clairsville, OH' },
  { lat: 40.0700, lon: -81.1800, label: 'Morristown area' },
  { lat: 40.0328, lon: -81.4623, label: 'Old Washington' },
  { lat: 40.0298, lon: -81.5891, label: 'Cambridge, OH' },
  { lat: 39.9970, lon: -81.7377, label: 'New Concord' },
  { lat: 39.9400, lon: -82.0129, label: 'Zanesville, OH' },
  { lat: 39.9612, lon: -82.2200, label: 'Gratiot area' },
  { lat: 39.9612, lon: -82.4364, label: 'Hebron / Buckeye Lake' },
  { lat: 39.9556, lon: -82.6200, label: 'Pataskala area' },
  { lat: 39.9556, lon: -82.7938, label: 'Reynoldsburg / Etna' },
  { lat: 39.9612, lon: -82.9988, label: 'Columbus (I-70/I-71 interchange)' },
  { lat: 40.0100, lon: -82.9600, label: 'I-70/I-71 north split' },
  { lat: 40.0500, lon: -82.9130, label: 'I-270 interchange (Easton)' },
  { lat: 40.0850, lon: -82.9130, label: 'I-270 N' },
  { lat: 40.1150, lon: -82.9130, label: 'I-270 & Cleveland Ave' },
  { lat: 40.1262, lon: -82.9291, label: 'Westerville, OH (destination)' },
]

/**
 * Densify the hardcoded waypoint list by linear-interpolating extra points
 * between each pair, so the map polyline renders smoothly and route-mile
 * lookups have finer granularity than the raw waypoint spacing.
 */
function densify(waypoints, maxSegmentMiles = 3) {
  const out = []
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i]
    const b = waypoints[i + 1]
    out.push(a)
    const segMiles = haversineMiles(a.lat, a.lon, b.lat, b.lon)
    const steps = Math.max(1, Math.ceil(segMiles / maxSegmentMiles))
    for (let s = 1; s < steps; s++) {
      const t = s / steps
      out.push({
        lat: a.lat + (b.lat - a.lat) * t,
        lon: a.lon + (b.lon - a.lon) * t,
      })
    }
  }
  out.push(waypoints[waypoints.length - 1])
  return out
}

function haversineMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// Dense point list used for the Leaflet polyline and for route-mile math.
export const ROUTE_POINTS = densify(ROUTE_WAYPOINTS)

// Cumulative mileage from Baltimore (route mile 0) at each ROUTE_POINTS index.
export const ROUTE_MILES = (() => {
  const miles = [0]
  for (let i = 1; i < ROUTE_POINTS.length; i++) {
    const prev = ROUTE_POINTS[i - 1]
    const cur = ROUTE_POINTS[i]
    miles.push(miles[i - 1] + haversineMiles(prev.lat, prev.lon, cur.lat, cur.lon))
  }
  return miles
})()

export const ROUTE_TOTAL_MILES = ROUTE_MILES[ROUTE_MILES.length - 1]

export const ROUTE_LATLNGS = ROUTE_POINTS.map((p) => [p.lat, p.lon])
