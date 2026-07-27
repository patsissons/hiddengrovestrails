export default function ColorSwatch({ hex, label }: { hex: string; label: string }) {
  return (
    <span
      className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-black/20"
      style={{ backgroundColor: hex }}
      role="img"
      aria-label={`${label} trail marker`}
    />
  )
}
