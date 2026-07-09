import { useEffect, useMemo, useState } from 'react'
import MapView from './components/MapView.jsx'
import SchematicView from './components/SchematicView.jsx'
import NextUpStrip from './components/NextUpStrip.jsx'
import LowerPanel from './components/LowerPanel.jsx'
import SettingsSheet from './components/SettingsSheet.jsx'
import { useGeolocation } from './hooks/useGeolocation.js'
import { useSimMode } from './hooks/useSimMode.js'
import { useWakeLock } from './hooks/useWakeLock.js'
import { useOnlineStatus } from './hooks/useOnlineStatus.js'
import { nearestOnRoute } from './lib/geo.js'
import { nearbyRepeaters, nextUpRepeater, distanceAndBearing, isNetNow } from './lib/repeaters.js'
import { generateChirpCsv, downloadCsv } from './lib/chirpExport.js'
import repeatersData from './data/repeaters.json'

const isPlaceholderData = repeatersData.some((r) => r.id.startsWith('mock-'))

function App() {
  const [band, setBand] = useState('both')
  const [minScore, setMinScore] = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [follow, setFollow] = useState(true)
  const [now, setNow] = useState(() => new Date())

  const sim = useSimMode()
  const gps = useGeolocation({ enabled: !sim.enabled })
  const wakeLock = useWakeLock()
  const online = useOnlineStatus()

  const position = sim.enabled ? sim.position : gps.position

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const currentRouteMile = useMemo(() => {
    if (!position) return 0
    return nearestOnRoute(position.lat, position.lon).routeMile
  }, [position])

  const filteredRepeaters = useMemo(
    () => repeatersData.filter((r) => (band === 'both' || r.band === band) && r.score >= minScore),
    [band, minScore],
  )

  const enrichedRepeaters = useMemo(() => {
    if (!position) return filteredRepeaters.map((r) => ({ ...r, distMiles: null, bearingDeg: null, compass: null }))
    return filteredRepeaters.map((r) => ({ ...r, ...distanceAndBearing(position, r) }))
  }, [filteredRepeaters, position])

  const netNowIds = useMemo(() => {
    const ids = new Set()
    for (const r of repeatersData) {
      if (isNetNow(r.net_times, now)) ids.add(r.id)
    }
    return ids
  }, [now])

  const nearby = useMemo(() => {
    if (!position) return []
    return nearbyRepeaters(repeatersData, position, currentRouteMile, { band, minScore })
  }, [position, currentRouteMile, band, minScore])

  const nextUp = useMemo(() => {
    if (!position) return null
    return nextUpRepeater(repeatersData, position, currentRouteMile, { band, minScore })
  }, [position, currentRouteMile, band, minScore])

  const selected = selectedId ? enrichedRepeaters.find((r) => r.id === selectedId) ?? null : null

  function handleExportCsv() {
    // Full corridor list, not the live-filtered subset — the point is to
    // pre-program the radio with every channel before driving.
    const csv = generateChirpCsv(repeatersData)
    downloadCsv('i70-repeater-companion-channels.csv', csv)
  }

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden bg-slate-950 text-slate-100">
      {online ? (
        <MapView
          repeaters={enrichedRepeaters}
          position={position}
          selectedId={selectedId}
          netNowIds={netNowIds}
          onSelectRepeater={setSelectedId}
          follow={follow}
          onToggleFollow={() => setFollow(true)}
          onUserDrag={() => setFollow(false)}
        />
      ) : (
        <SchematicView
          repeaters={enrichedRepeaters}
          currentRouteMile={currentRouteMile}
          selectedId={selectedId}
          onSelectRepeater={setSelectedId}
        />
      )}

      {isPlaceholderData && (
        <div className="absolute top-0 left-0 right-0 z-[1200] safe-top bg-amber-600 text-slate-950 text-xs font-bold text-center py-1">
          Placeholder data — run <code>npm run ingest</code> with the real RepeaterBook export
        </div>
      )}

      {!position && (
        <div className="absolute inset-0 z-[1050] bg-slate-950/90 flex items-center justify-center px-6 text-center">
          <div>
            <div className="text-xl font-bold mb-2">Waiting for GPS…</div>
            <div className="text-slate-400 text-sm">
              Grant location access, or enable Sim mode in settings to test on a desk.
            </div>
          </div>
        </div>
      )}

      <NextUpStrip
        repeater={nextUp}
        milesAhead={nextUp ? nextUp.route_mile - currentRouteMile : 0}
        onClick={() => nextUp && setSelectedId(nextUp.id)}
      />

      <LowerPanel
        nearby={nearby}
        selected={selected}
        netNowIds={netNowIds}
        onSelect={setSelectedId}
        onCollapse={() => setSelectedId(null)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        band={band}
        setBand={setBand}
        minScore={minScore}
        setMinScore={setMinScore}
        sim={sim}
        wakeLock={wakeLock}
        onExportCsv={handleExportCsv}
        channelCount={repeatersData.length}
      />
    </div>
  )
}

export default App
