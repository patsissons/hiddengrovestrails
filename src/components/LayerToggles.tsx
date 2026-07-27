import type { LayerVisibility } from '@/lib/map/layers'
import { cn } from '@/lib/utils'

interface LayerTogglesProps {
  visibility: LayerVisibility
  onChange: (visibility: LayerVisibility) => void
}

const TOGGLES: { key: keyof LayerVisibility; label: string }[] = [
  { key: 'trails', label: 'Trails' },
  { key: 'junctions', label: 'Junctions' },
  { key: 'route', label: 'Route' },
]

export default function LayerToggles({ visibility, onChange }: LayerTogglesProps) {
  return (
    <div
      className="absolute left-2 top-2 z-10 flex gap-1 rounded-lg bg-white/90 p-1 shadow-md backdrop-blur"
      role="group"
      aria-label="Map layers"
    >
      {TOGGLES.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          aria-pressed={visibility[key]}
          onClick={() => onChange({ ...visibility, [key]: !visibility[key] })}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            visibility[key]
              ? 'bg-slate-800 text-white'
              : 'bg-transparent text-slate-500 hover:bg-slate-200',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
