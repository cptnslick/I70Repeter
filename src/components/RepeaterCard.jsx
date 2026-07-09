import { formatOffset, formatTone, scoreColor } from '../lib/repeaters.js'

export default function RepeaterCard({ repeater, isSelected, isNetNow, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 w-44 text-left rounded-2xl p-3 border-2 transition-colors ${
        isSelected ? 'border-sky-400 bg-slate-800' : 'border-slate-700 bg-slate-800/70'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-500">CH {repeater.channel}</span>
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-slate-950"
          style={{ background: scoreColor(repeater.score) }}
        >
          {repeater.score}
        </span>
      </div>
      <div className="text-3xl font-black tabular-nums leading-none">{repeater.freq.toFixed(3)}</div>
      <div className="mt-1 text-sm text-slate-300">
        {formatOffset(repeater.offset)} &middot; {formatTone(repeater.tone_in)}
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
        <span className="truncate">{repeater.callsign || '—'}</span>
        <span className="shrink-0 ml-2">
          {repeater.distMiles?.toFixed(0)}mi {repeater.compass}
        </span>
      </div>
      {isNetNow && (
        <div className="mt-1 text-[10px] font-extrabold text-red-400">NET NOW</div>
      )}
    </button>
  )
}
