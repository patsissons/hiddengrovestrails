import { useCallback, useEffect, useRef, useState } from 'react'
import { Share2 } from 'lucide-react'

export default function ShareButton({ disabled }: { disabled: boolean }) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const share = useCallback(async () => {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Hidden Groves route', url })
        return
      }
    } catch {
      // fall through to clipboard (e.g. user dismissed the share sheet)
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setCopied(false), 2000)
  }, [])

  return (
    <button
      type="button"
      onClick={share}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
    >
      <Share2 className="h-4 w-4" aria-hidden />
      {copied ? 'Copied!' : 'Share'}
    </button>
  )
}
