import RepeaterCard from './RepeaterCard.jsx'
import RepeaterDetail from './RepeaterDetail.jsx'

export default function LowerPanel({ nearby, selected, netNowIds, onSelect, onCollapse, onOpenSettings }) {
  const expanded = Boolean(selected)

  return (
    <div
      className={`absolute left-0 right-0 bottom-0 z-[950] safe-bottom bg-slate-900/97 border-t border-slate-700 rounded-t-2xl transition-[height] duration-200 ${
        expanded ? 'h-[70vh]' : 'h-auto'
      }`}
    >
      <div className="flex items-center justify-between px-4 pt-2 pb-1">
        <div className="w-10 h-1.5 rounded-full bg-slate-600 mx-auto" />
      </div>

      {!expanded && (
        <div className="flex items-center justify-between px-4 pb-1">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Nearby repeaters</span>
          <button onClick={onOpenSettings} className="text-slate-400 text-lg px-2" aria-label="Filters and settings">
            &#9881;
          </button>
        </div>
      )}

      {!expanded && (
        <div className="flex gap-3 overflow-x-auto px-4 pb-4 pt-1">
          {nearby.length === 0 && (
            <div className="text-sm text-slate-500 py-4">No repeaters in range yet — keep driving.</div>
          )}
          {nearby.map((r) => (
            <RepeaterCard
              key={r.id}
              repeater={r}
              isSelected={false}
              isNetNow={netNowIds.has(r.id)}
              onClick={() => onSelect(r.id)}
            />
          ))}
        </div>
      )}

      {expanded && (
        <RepeaterDetail repeater={selected} isNetNow={netNowIds.has(selected.id)} onClose={onCollapse} />
      )}
    </div>
  )
}
