import { useEffect } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ROUTE_LATLNGS } from '../data/route.js'
import { scoreColor } from '../lib/repeaters.js'

const DEFAULT_CENTER = [39.65, -78.8] // roughly mid-corridor
const DEFAULT_ZOOM = 8

function gpsIcon(headingDeg) {
  const rotation = Number.isFinite(headingDeg) ? headingDeg : 0
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width: 22px; height: 22px; border-radius: 50%;
        background: #3b82f6; border: 3px solid white;
        box-shadow: 0 0 0 2px rgba(59,130,246,0.5), 0 2px 6px rgba(0,0,0,0.5);
        transform: rotate(${rotation}deg);
        position: relative;
      ">
        <div style="
          position: absolute; top: -9px; left: 50%; transform: translateX(-50%);
          width: 0; height: 0;
          border-left: 5px solid transparent; border-right: 5px solid transparent;
          border-bottom: 8px solid #3b82f6;
        "></div>
      </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

function repeaterIcon(repeater, isSelected, isNetNow) {
  const color = scoreColor(repeater.score)
  const size = 14 + Math.round((repeater.score / 100) * 14) // 14-28px
  const ring = isSelected ? '0 0 0 3px white, 0 0 0 5px ' + color : '0 2px 4px rgba(0,0,0,0.6)'
  return L.divIcon({
    className: '',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center;">
        <div style="position: relative; width: ${size}px; height: ${size}px;">
          <div class="${isNetNow ? 'net-pulse' : ''}" style="
            width: 100%; height: 100%; border-radius: 50%;
            background: ${color}; box-shadow: ${ring};
          "></div>
          <div style="
            position: absolute; top: -6px; right: -6px; min-width: 14px; height: 14px;
            padding: 0 3px; border-radius: 7px; background: #0b0f14; border: 1px solid ${color};
            color: #fff; font-size: 9px; font-weight: 800; line-height: 14px; text-align: center;
          ">${repeater.channel}</div>
        </div>
        <div style="
          position: absolute; top: ${size + 2}px; left: 50%; transform: translateX(-50%);
          font-size: 9px; font-weight: 700; color: #e6edf3; background: rgba(11,15,20,0.85);
          padding: 1px 4px; border-radius: 4px; white-space: nowrap;
        ">${repeater.band}</div>
        ${isNetNow ? '<div style="position:absolute; bottom: -14px; left: 50%; transform: translateX(-50%); font-size: 8px; font-weight: 800; color: #fff; background: #dc2626; padding: 1px 4px; border-radius: 4px; white-space: nowrap;">NET NOW</div>' : ''}
      </div>`,
    iconSize: [size + 20, size + 24],
    iconAnchor: [(size + 20) / 2, (size + 24) / 2],
  })
}

function AutoFollow({ position, follow }) {
  const map = useMap()
  useEffect(() => {
    if (follow && position) {
      map.setView([position.lat, position.lon], Math.max(map.getZoom(), 11), { animate: true })
    }
  }, [follow, position, map])
  return null
}

function UserDragWatcher({ onUserDrag }) {
  useMapEvents({ dragstart: () => onUserDrag() })
  return null
}

function RecenterControl({ onRecenter }) {
  return (
    <button
      onClick={onRecenter}
      className="absolute right-3 bottom-3 z-[1000] bg-slate-800/90 border border-slate-600 text-white rounded-full w-12 h-12 flex items-center justify-center text-xl shadow-lg active:scale-95"
      aria-label="Re-center map"
    >
      &#8982;
    </button>
  )
}

export default function MapView({ repeaters, position, selectedId, netNowIds, onSelectRepeater, follow, onToggleFollow, onUserDrag }) {
  return (
    <div className="relative w-full h-full">
      <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} zoomControl={false} className="w-full h-full">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
          maxZoom={19}
        />
        <Polyline positions={ROUTE_LATLNGS} pathOptions={{ color: '#38bdf8', weight: 3, opacity: 0.6 }} />

        {repeaters.map((r) => (
          <Marker
            key={r.id}
            position={[r.lat, r.lon]}
            icon={repeaterIcon(r, r.id === selectedId, netNowIds.has(r.id))}
            eventHandlers={{ click: () => onSelectRepeater(r.id) }}
          />
        ))}

        {position && <Marker position={[position.lat, position.lon]} icon={gpsIcon(position.heading)} zIndexOffset={1000} />}

        <AutoFollow position={position} follow={follow} />
        <UserDragWatcher onUserDrag={onUserDrag} />
      </MapContainer>

      <RecenterControl onRecenter={onToggleFollow} />
    </div>
  )
}
