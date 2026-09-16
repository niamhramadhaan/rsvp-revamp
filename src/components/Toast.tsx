import { useEffect, useState } from 'react'
import { CheckmarkIcon, InfoIcon, AlertTriangleIcon } from './icons/UiIcons'
import { playSound } from '../utils/sound'

const DISPLAY_MS = 2200

export type ToastTone = 'success' | 'info' | 'warning'

// Every call site across the app fires a bare string today (`onToast('X
// added')`) — `tone` is optional and defaults to 'success' so none of those
// need to change; only the handful of call sites that are actually a nudge
// ("Select a guest first") or a stub ("coming soon") bother passing one.
export interface ToastState {
  message: string
  tone?: ToastTone
}

export interface ToastProps {
  toast?: ToastState | null
}

const TONE_STYLE: Record<ToastTone, { wash: string; icon: typeof CheckmarkIcon }> = {
  success: { wash: 'bg-ink-900 text-white', icon: CheckmarkIcon },
  info: { wash: 'bg-accent-700 text-white', icon: InfoIcon },
  warning: { wash: 'bg-status-pending text-white', icon: AlertTriangleIcon },
}

const TONE_CUE: Record<ToastTone, Parameters<typeof playSound>[0]> = {
  success: 'success',
  info: 'info',
  warning: 'warning',
}

// Stylized bottom-right toast — fire-and-forget: pass a new `toast` object
// whenever something should be announced, and this handles its own
// show/auto-hide timing and smooth enter/exit transition.
export default function Toast({ toast }: ToastProps) {
  const [visible, setVisible] = useState(false)
  const message = toast?.message

  useEffect(() => {
    if (!message) return undefined

    playSound(TONE_CUE[toast?.tone ?? 'success'])
    const showTimer = setTimeout(() => setVisible(true), 10)
    const hideTimer = setTimeout(() => setVisible(false), DISPLAY_MS)

    return () => {
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
      setVisible(false)
    }
  }, [message])

  const { wash, icon: Icon } = TONE_STYLE[toast?.tone ?? 'success']

  return (
    <div
      aria-live="polite"
      // Below lg, the mobile bottom tab bar (EventTabs) now occupies the
      // bottom strip of the screen — this used to always sit at bottom-6,
      // which would land the toast right on top of that bar. Clears it with
      // room to spare on mobile, back to the original bottom-6 at lg: where
      // there's no bottom bar.
      className={`pointer-events-none fixed right-6 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[60] transition-[opacity,transform] duration-300 ease-out lg:bottom-6 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      }`}
    >
      <div className={`relative flex items-center gap-2.5 overflow-hidden rounded-xl px-4 py-3 text-sm font-medium shadow-xl ${wash}`}>
        <Icon className="h-4 w-4 shrink-0" />
        {message}
        {/* Auto-dismiss countdown — every toast stays up for DISPLAY_MS
            (2.2s, always at least the 2s a real wait is worth showing
            progress for), so this drains left-to-right over that same
            span instead of the toast just vanishing with no warning.
            Keyed by message so a genuinely new toast always restarts the
            drain from full, rather than continuing whatever span the
            previous one was partway through. */}
        <div
          key={message}
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-white/40"
          style={{ animation: `toast-progress-drain ${DISPLAY_MS}ms linear forwards` }}
        />
      </div>
    </div>
  )
}
