import { useState } from 'react'
import { ChevronDown, ChevronUp, RotateCcw, Trash2 } from 'lucide-react'
import type { JunctionId, TrailGraph } from '@/lib/graph/types'
import type { RouteToken } from '@/lib/route/codec'
import type { Route } from '@/lib/route/validate'
import { computeStats } from '@/lib/route/stats'
import CandidateList from './CandidateList'
import ShareButton from './ShareButton'
import StatsSummary from './StatsSummary'
import StepList from './StepList'
import { cn } from '@/lib/utils'

interface RoutePanelProps {
  graph: TrailGraph
  tokens: RouteToken[]
  route: Route | null
  candidates: JunctionId[]
  lastJunction: JunctionId | null
  onSelect: (junction: JunctionId, alt?: string) => void
  onUndo: () => void
  onClear: () => void
}

export default function RoutePanel({
  graph,
  tokens,
  route,
  candidates,
  lastJunction,
  onSelect,
  onUndo,
  onClear,
}: RoutePanelProps) {
  const [expanded, setExpanded] = useState(true)

  return (
    <section
      aria-label="Route builder"
      className={cn(
        'absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-2xl bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.15)]',
        'md:inset-x-auto md:top-0 md:bottom-0 md:left-0 md:w-96 md:rounded-t-none md:shadow-[4px_0_16px_rgba(0,0,0,0.1)]',
        expanded ? 'max-h-[60dvh] md:max-h-none' : 'max-h-14 overflow-hidden md:max-h-none',
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex h-14 shrink-0 items-center justify-between gap-2 px-4 md:hidden"
      >
        <PanelTitle tokens={tokens} route={route} />
        {expanded ? (
          <ChevronDown className="h-5 w-5 text-slate-400" aria-hidden />
        ) : (
          <ChevronUp className="h-5 w-5 text-slate-400" aria-hidden />
        )}
      </button>
      <div className="hidden h-14 shrink-0 items-center px-4 md:flex">
        <PanelTitle tokens={tokens} route={route} />
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {route ? (
          <>
            <div className="flex flex-wrap items-center gap-2" data-testid="route-sequence">
              {tokens.map((t, i) => (
                <span
                  key={i}
                  className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-800 px-1.5 text-xs font-bold text-white"
                >
                  {t.junction}
                  {t.alt ?? ''}
                </span>
              ))}
              <button
                type="button"
                onClick={onUndo}
                aria-label="Remove last stop"
                className="inline-flex h-7 items-center gap-1 rounded-full border border-slate-300 px-2 text-xs hover:bg-slate-100"
              >
                <RotateCcw className="h-3 w-3" aria-hidden /> Undo
              </button>
              <button
                type="button"
                onClick={onClear}
                aria-label="Clear route"
                className="inline-flex h-7 items-center gap-1 rounded-full border border-slate-300 px-2 text-xs hover:bg-slate-100"
              >
                <Trash2 className="h-3 w-3" aria-hidden /> Clear
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <StatsSummary stats={computeStats(route)} />
              <ShareButton disabled={route.steps.length === 0} />
            </div>
            <StepList route={route} />
          </>
        ) : (
          <p className="text-sm text-slate-600">
            Tap any numbered intersection on the map to start a route. The numbers match the markers
            on the official Hidden Groves map.
          </p>
        )}
        {lastJunction !== null && (
          <CandidateList
            graph={graph}
            from={lastJunction}
            candidates={candidates}
            onSelect={onSelect}
          />
        )}
      </div>
    </section>
  )
}

function PanelTitle({ tokens, route }: { tokens: RouteToken[]; route: Route | null }) {
  return (
    <h2 className="text-sm font-semibold">
      {route && tokens.length > 0
        ? `Route: ${tokens[0].junction} → ${tokens[tokens.length - 1].junction}`
        : 'Plan a route'}
    </h2>
  )
}
