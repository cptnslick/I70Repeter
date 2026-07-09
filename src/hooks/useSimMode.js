import { useEffect, useRef, useState } from 'react'
import { ROUTE_POINTS, ROUTE_MILES, ROUTE_TOTAL_MILES } from '../data/route.js'
import { bearing } from '../lib/geo.js'

const TICK_MS = 1000

/** Find lat/lon + heading at a given route mile via linear interpolation. */
function positionAtMile(mile) {
  const clamped = Math.max(0, Math.min(mile, ROUTE_TOTAL_MILES))
  // ROUTE_MILES is monotonically increasing; linear scan is fine at this size.
  let i = 0
  while (i < ROUTE_MILES.length - 2 && ROUTE_MILES[i + 1] < clamped) i++
  const a = ROUTE_POINTS[i]
  const b = ROUTE_POINTS[Math.min(i + 1, ROUTE_POINTS.length - 1)]
  const milesA = ROUTE_MILES[i]
  const milesB = ROUTE_MILES[Math.min(i + 1, ROUTE_MILES.length - 1)]
  const t = milesB > milesA ? (clamped - milesA) / (milesB - milesA) : 0
  const lat = a.lat + (b.lat - a.lat) * t
  const lon = a.lon + (b.lon - a.lon) * t
  const heading = bearing(a.lat, a.lon, b.lat, b.lon)
  return { lat, lon, heading, routeMile: clamped }
}

/**
 * Dev toggle: animates a simulated GPS position along the route polyline
 * so the app can be exercised on a desk without driving.
 */
export function useSimMode({ startMile = 0, speedMph = 55 } = {}) {
  const [enabled, setEnabled] = useState(false)
  const [speed, setSpeed] = useState(speedMph)
  const [position, setPosition] = useState(() => ({ ...positionAtMile(startMile), timestamp: Date.now() }))
  const mileRef = useRef(startMile)

  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => {
      mileRef.current += (speed * TICK_MS) / (1000 * 3600)
      if (mileRef.current >= ROUTE_TOTAL_MILES) mileRef.current = ROUTE_TOTAL_MILES
      setPosition({ ...positionAtMile(mileRef.current), timestamp: Date.now() })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [enabled, speed])

  function reset(mile = 0) {
    mileRef.current = mile
    setPosition({ ...positionAtMile(mile), timestamp: Date.now() })
  }

  return { enabled, setEnabled, speed, setSpeed, position, reset }
}
