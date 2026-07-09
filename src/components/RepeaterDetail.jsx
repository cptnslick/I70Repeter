import { useState } from 'react'
import { formatOffset, formatTone, scoreColor } from '../lib/repeaters.js'

export default function RepeaterDetail({ repeater, isNetNow, onClose }) {
  const [copied, setCopied] = useState(false)

  async function copyFreq() {
    const text = `${repeater.freq.toFixed(3)} ${formatOffset(repeater.offset)} ${formatTone(repeater.tone_in)}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard API unavailable — no-op, freq is still visible on screen.
    }
  }

  return (
    <div className="px-4 pb-4 flex flex-col gap-3 overflow-y-auto">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-5xl font-black tabular-nums leading-none">{repeater.freq.toFixed(3)}</div>
          <div className="mt-1 text-lg text-slate-300">
            {formatOffset(repeater.offset)} &middot; {formatTone(repeater.tone_in)}
            {repeater.tone_out ? ` / TSQ ${repeater.tone_out}` : ''}
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-11 h-11 rounded-full bg-slate-800 border border-slate-600 text-2xl flex items-center justify-center"
          aria-label="Close"
        >
          &times;
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-700 tabular-nums">CH {repeater.channel}</span>
        <span
          className="text-xs font-bold px-2 py-1 rounded-full text-slate-950"
          style={{ background: scoreColor(repeater.score) }}
        >
          Score {repeater.score}
        </span>
        <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-700">{repeater.band}</span>
        {isNetNow && (
          <span className="text-xs font-extrabold px-2 py-1 rounded-full bg-red-600 text-white">NET NOW</span>
        )}
      </div>

      <button
        onClick={copyFreq}
        className="w-full py-3 rounded-xl bg-sky-600 active:bg-sky-700 font-bold text-lg"
      >
        {copied ? 'Copied!' : 'Copy freq'}
      </button>

      <div className="text-base">
        <div className="font-bold">{repeater.callsign || 'Unknown callsign'}</div>
        <div className="text-slate-400">
          {[repeater.city, repeater.county && `${repeater.county} Co.`, repeater.state].filter(Boolean).join(', ')}
        </div>
        {repeater.club && <div className="mt-1 text-slate-300">{repeater.club}</div>}
        {repeater.club_url && (
          <a href={repeater.club_url} target="_blank" rel="noreferrer" className="text-sky-400 underline text-sm">
            Club website
          </a>
        )}
      </div>

      {repeater.evidence?.length > 0 && (
        <ul className="text-sm text-slate-300 list-disc list-inside space-y-1">
          {repeater.evidence.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}

      <div className="text-sm text-slate-400 grid grid-cols-2 gap-x-4 gap-y-1">
        {repeater.echolink && <div>EchoLink linked</div>}
        {repeater.allstar && <div>AllStar linked</div>}
        {repeater.irlp && <div>IRLP linked</div>}
        {repeater.wires && <div>Fusion / Wires-X linked</div>}
        {repeater.last_verified && <div>Verified: {repeater.last_verified}</div>}
        <div>
          {repeater.distMiles?.toFixed(1)}mi {repeater.compass}
        </div>
      </div>

      {repeater.rb_url && (
        <a href={repeater.rb_url} target="_blank" rel="noreferrer" className="text-sky-400 underline text-sm">
          View on RepeaterBook
        </a>
      )}

      <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800">
        Data courtesy of RepeaterBook.com
      </div>
    </div>
  )
}
