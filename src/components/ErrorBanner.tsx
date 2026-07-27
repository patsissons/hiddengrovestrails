export default function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string
  onDismiss: () => void
}) {
  return (
    <div
      role="alert"
      data-testid="error-banner"
      className="absolute top-2 left-1/2 z-20 flex w-[min(92vw,28rem)] -translate-x-1/2 items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 shadow-md"
    >
      <span className="flex-1">
        {message} The route from this link could not be loaded — start a fresh one by tapping any
        numbered intersection.
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded px-1 font-bold hover:bg-red-100"
      >
        ×
      </button>
    </div>
  )
}
