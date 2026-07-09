import { formatOffset, formatTone, scoreColor } from '../lib/repeaters.js'

export default function NextUpStrip({ repeater, milesAhead, onClick }) {
  if (!repeater) return null
  return (
    <button
      onClick={onClick}
      className="absolute top-0 left-0 right-0 z-[900] safe-top bg-slate-900/95 border-b border-slate-700 px-4 py-2 flex items-center gap-3 text-left"
    >
      <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400 shrink-0">Next up</span>
      <span className="text-2xl font-black tabular-nums">{repeater.freq.toFixed(3)}</span>
      <span className="text-sm text-slate-300">
        {formatOffset(repeater.offset)} &middot; {formatTone(repeater.tone_in)}
      </span>
      <span className="ml-auto text-sm text-slate-400 shrink-0">in {Math.max(0, Math.round(milesAhead))}mi</span>
      <span
        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-slate-950 shrink-0"
        style={{ background: scoreColor(repeater.score) }}
      >
        {repeater.score}
      </span>
    </button>
  )
}
