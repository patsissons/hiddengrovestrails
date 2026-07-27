import type { Route } from '@/lib/route/validate'
import ColorSwatch from './ColorSwatch'
import { describeEdge, formatDistance } from '@/lib/format'

export default function StepList({ route }: { route: Route }) {
  if (route.steps.length === 0) return null
  return (
    <ol className="space-y-1" data-testid="step-list">
      {route.steps.map((step, i) => (
        <li
          key={`${i}-${step.edge.key}`}
          className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-sm"
        >
          <span className="w-5 shrink-0 text-right font-mono text-xs text-slate-400">{i + 1}.</span>
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
            {step.to}
          </span>
          <ColorSwatch hex={step.edge.colorHex} label={step.edge.color} />
          <span className="min-w-0 flex-1 truncate">
            follow <strong>{describeEdge(step.edge.color, step.edge.name)}</strong>
          </span>
          <span className="shrink-0 text-xs text-slate-500">
            {step.edge.minutes ?? '—'} min · {formatDistance(step.edge.distanceM)}
          </span>
        </li>
      ))}
    </ol>
  )
}
