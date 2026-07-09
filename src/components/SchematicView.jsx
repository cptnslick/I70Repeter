import { useEffect, useRef } from 'react'
import { ROUTE_WAYPOINTS, ROUTE_TOTAL_MILES } from '../data/route.js'
import { scoreColor } from '../lib/repeaters.js'

const PX_PER_MILE = 6
const LANE_X = 90

// Only label the more recognizable waypoints so the strip isn't cluttered.
const MAJOR_LABELS = new Set([
  'Baltimore (I-70 start / I-695)',
  'Frederick',
  'Hagerstown',
  'Hancock',
  'Breezewood (onto PA Turnpike I-76 W)',
  'Somerset (Turnpike)',
  'New Stanton (back onto I-70 W)',
  'Washington, PA',
  'Wheeling, WV',
  'Cambridge, OH',
  'Zanesville, OH',
  'Columbus (I-70/I-71 interchange)',
  'Westerville, OH (destination)',
])

function mileOfLabel(label) {
  // Cheap re-derivation: find waypoint index and approximate its mile by
  // fraction of waypoint list — good enough for a schematic label position.
  const idx = ROUTE_WAYPOINTS.findIndex((w) => w.label === label)
  return (idx / (ROUTE_WAYPOINTS.length - 1)) * ROUTE_TOTAL_MILES
}

export default function SchematicView({ repeaters, currentRouteMile, selectedId, onSelectRepeater }) {
  const markerRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    markerRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [currentRouteMile])

  const height = ROUTE_TOTAL_MILES * PX_PER_MILE + 80

  return (
    <div ref={containerRef} className="w-full h-full overflow-y-auto bg-slate-950">
      <div className="px-3 py-2 text-xs text-amber-400 font-bold sticky top-0 bg-slate-950/95 z-10 border-b border-slate-800">
        Offline — schematic route view (map tiles unavailable)
      </div>
      <svg width="100%" height={height} viewBox={`0 0 220 ${height}`} className="block">
        <line x1={LANE_X} y1={20} x2={LANE_X} y2={height - 20} stroke="#334155" strokeWidth={4} />

        {ROUTE_WAYPOINTS.filter((w) => MAJOR_LABELS.has(w.label)).map((w) => {
          const y = 20 + mileOfLabel(w.label) * PX_PER_MILE
          return (
            <g key={w.label}>
              <circle cx={LANE_X} cy={y} r={3} fill="#64748b" />
              <text x={LANE_X + 10} y={y + 4} fontSize={9} fill="#94a3b8">
                {w.label.replace(/\s*\(.*\)$/, '')}
              </text>
            </g>
          )
        })}

        {repeaters.map((r) => {
          const y = 20 + r.route_mile * PX_PER_MILE
          const side = r.band === '2m' ? -1 : 1
          const x = LANE_X + side * 24
          const isSelected = r.id === selectedId
          return (
            <g
              key={r.id}
              transform={`translate(${x}, ${y})`}
              onClick={() => onSelectRepeater(r.id)}
              style={{ cursor: 'pointer' }}
            >
              <line x1={side * -20} y1={0} x2={0} y2={0} stroke="#334155" strokeWidth={1} />
              <circle r={isSelected ? 8 : 6} fill={scoreColor(r.score)} stroke={isSelected ? '#fff' : 'none'} strokeWidth={2} />
              <text x={side * 12} y={4} fontSize={9} fontWeight={700} fill="#e6edf3" textAnchor={side < 0 ? 'end' : 'start'}>
                {r.freq.toFixed(3)}
              </text>
            </g>
          )
        })}

        <g ref={markerRef} transform={`translate(${LANE_X}, ${20 + currentRouteMile * PX_PER_MILE})`}>
          <circle r={9} fill="#3b82f6" stroke="#fff" strokeWidth={2} />
          <text x={0} y={-14} fontSize={9} fontWeight={800} fill="#3b82f6" textAnchor="middle">
            YOU
          </text>
        </g>
      </svg>
    </div>
  )
}
