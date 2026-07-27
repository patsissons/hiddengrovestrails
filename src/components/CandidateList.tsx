import type { JunctionId, TrailGraph } from '@/lib/graph/types'
import { edgesBetween } from '@/lib/route/validate'
import ColorSwatch from './ColorSwatch'
import { describeEdge, formatDistance } from '@/lib/format'

interface CandidateListProps {
  graph: TrailGraph
  from: JunctionId
  candidates: JunctionId[]
  onSelect: (junction: JunctionId, alt?: string) => void
}

export default function CandidateList({ graph, from, candidates, onSelect }: CandidateListProps) {
  if (candidates.length === 0) return null
  return (
    <div data-testid="candidate-list">
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        Continue from {from}
      </h3>
      <ul className="space-y-1">
        {candidates.flatMap((to) =>
          edgesBetween(graph, from, to).map((edge) => {
            const base = `${Math.min(from, to)}-${Math.max(from, to)}`
            const alt = edge.key.slice(base.length) || undefined
            return (
              <li key={edge.key}>
                <button
                  type="button"
                  onClick={() => onSelect(to, alt)}
                  className="flex w-full items-center gap-2 rounded-md border border-slate-200 px-2 py-1.5 text-left text-sm hover:bg-slate-100"
                >
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
                    {to}
                  </span>
                  <ColorSwatch hex={edge.colorHex} label={edge.color} />
                  <span className="min-w-0 flex-1 truncate">
                    via {describeEdge(edge.color, edge.name)}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {edge.minutes ?? '—'} min · {formatDistance(edge.distanceM)}
                  </span>
                </button>
              </li>
            )
          }),
        )}
      </ul>
    </div>
  )
}
