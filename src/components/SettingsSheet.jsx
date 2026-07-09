const BAND_OPTIONS = [
  { value: 'both', label: 'Both' },
  { value: '2m', label: '2m' },
  { value: '70cm', label: '70cm' },
]

export default function SettingsSheet({
  open,
  onClose,
  band,
  setBand,
  minScore,
  setMinScore,
  sim,
  wakeLock,
}) {
  if (!open) return null

  return (
    <div className="absolute inset-0 z-[1100] bg-black/60 flex items-end" onClick={onClose}>
      <div
        className="w-full bg-slate-900 rounded-t-2xl safe-bottom p-4 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Filters &amp; settings</h2>
          <button onClick={onClose} className="w-11 h-11 rounded-full bg-slate-800 text-2xl" aria-label="Close">
            &times;
          </button>
        </div>

        <div>
          <div className="text-sm font-bold text-slate-400 mb-2">Band</div>
          <div className="flex gap-2">
            {BAND_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setBand(opt.value)}
                className={`flex-1 py-3 rounded-xl font-bold text-lg ${
                  band === opt.value ? 'bg-sky-600' : 'bg-slate-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-sm font-bold text-slate-400 mb-2">Min score: {minScore}</div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="w-full h-12"
          />
        </div>

        {wakeLock.supported && (
          <label className="flex items-center justify-between py-2">
            <span className="text-sm font-bold text-slate-400">Keep screen on</span>
            <input
              type="checkbox"
              checked={wakeLock.enabled}
              onChange={(e) => wakeLock.setEnabled(e.target.checked)}
              className="w-8 h-8"
            />
          </label>
        )}

        <div className="border-t border-slate-800 pt-4">
          <label className="flex items-center justify-between py-2">
            <span className="text-sm font-bold text-slate-400">Sim mode (dev)</span>
            <input
              type="checkbox"
              checked={sim.enabled}
              onChange={(e) => sim.setEnabled(e.target.checked)}
              className="w-8 h-8"
            />
          </label>
          {sim.enabled && (
            <div className="flex items-center gap-3 mt-2">
              <span className="text-sm text-slate-400">Speed</span>
              <input
                type="range"
                min={10}
                max={80}
                step={5}
                value={sim.speed}
                onChange={(e) => sim.setSpeed(Number(e.target.value))}
                className="flex-1 h-10"
              />
              <span className="text-sm tabular-nums w-14 text-right">{sim.speed} mph</span>
              <button onClick={() => sim.reset(0)} className="text-sm bg-slate-800 px-3 py-2 rounded-lg">
                Reset
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
