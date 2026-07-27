import type { RouteStats } from '@/lib/route/stats'
import { formatDistance } from '@/lib/format'

export default function StatsSummary({ stats }: { stats: RouteStats }) {
  return (
    <div className="flex gap-2" data-testid="stats-summary">
      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-semibold text-emerald-900">
        {stats.totalMinutes === null ? '— min' : `~${stats.totalMinutes} min`}
      </span>
      <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-sm font-semibold text-sky-900">
        {formatDistance(stats.totalDistanceM)}
      </span>
      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-sm font-semibold text-slate-700">
        {stats.stepCount} {stats.stepCount === 1 ? 'leg' : 'legs'}
      </span>
    </div>
  )
}
