import { useEffect, useRef, useState } from 'react'
import { bearing } from '../lib/geo.js'

const UPDATE_THROTTLE_MS = 5000

/**
 * Wraps navigator.geolocation.watchPosition, throttled to ~5s UI updates.
 * Derives heading from successive fixes when the device doesn't report one
 * (common when stationary or on some Android/iOS combos).
 */
export function useGeolocation({ enabled = true } = {}) {
  const [position, setPosition] = useState(null)
  const [error, setError] = useState(null)
  const lastUpdateRef = useRef(0)
  const lastFixRef = useRef(null)

  useEffect(() => {
    if (!enabled) return
    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported on this device')
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (fix) => {
        const now = Date.now()
        if (now - lastUpdateRef.current < UPDATE_THROTTLE_MS) return
        lastUpdateRef.current = now

        const { latitude: lat, longitude: lon, heading, accuracy, speed } = fix.coords
        let derivedHeading = heading
        if ((derivedHeading === null || Number.isNaN(derivedHeading)) && lastFixRef.current) {
          const prev = lastFixRef.current
          if (haversineMovedEnough(prev, { lat, lon })) {
            derivedHeading = bearing(prev.lat, prev.lon, lat, lon)
          } else {
            derivedHeading = prev.heading ?? null
          }
        }

        const next = { lat, lon, heading: derivedHeading, accuracy, speed, timestamp: fix.timestamp }
        lastFixRef.current = next
        setPosition(next)
        setError(null)
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [enabled])

  return { position, error }
}

function haversineMovedEnough(a, b) {
  // Cheap check: only derive heading if we moved a meaningful amount
  // (avoids jittery bearings from GPS noise while stationary).
  const dLat = Math.abs(a.lat - b.lat)
  const dLon = Math.abs(a.lon - b.lon)
  return dLat > 0.00005 || dLon > 0.00005
}
