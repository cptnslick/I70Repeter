import { useEffect, useRef, useState } from 'react'

/** Screen Wake Lock toggle so the display doesn't sleep while mounted. */
export function useWakeLock() {
  const [enabled, setEnabled] = useState(false)
  const [supported] = useState(() => 'wakeLock' in navigator)
  const sentinelRef = useRef(null)

  useEffect(() => {
    if (!enabled || !supported) return
    let cancelled = false

    async function acquire() {
      try {
        sentinelRef.current = await navigator.wakeLock.request('screen')
      } catch {
        if (!cancelled) setEnabled(false)
      }
    }
    acquire()

    function onVisibilityChange() {
      if (document.visibilityState === 'visible' && enabled) acquire()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      sentinelRef.current?.release().catch(() => {})
      sentinelRef.current = null
    }
  }, [enabled, supported])

  return { enabled, setEnabled, supported }
}
