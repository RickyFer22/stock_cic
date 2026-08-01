export type BannerTone = 'success' | 'error' | 'info'

export type Feedback = { tone: BannerTone; text: string } | null

const TONE_CLASS: Record<BannerTone, string> = {
  success: 'bg-state-ok-bg border-state-ok/25 text-state-ok',
  error: 'bg-state-danger-bg border-state-danger/25 text-state-danger',
  info: 'bg-state-info-bg border-state-info-bg text-state-info',
}

const TONE_ICON: Record<BannerTone, string> = {
  success: '✓',
  error: '⚠',
  info: 'ℹ',
}

/**
 * Aviso en línea, en reemplazo de los alert() nativos: no bloquea la interacción,
 * respeta el estilo del sistema y se puede descartar.
 */
export default function Banner({ feedback, onDismiss }: { feedback: Feedback; onDismiss: () => void }) {
  if (!feedback) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 rounded-[--radius-card] border px-4 py-3 text-sm font-semibold ${TONE_CLASS[feedback.tone]}`}
    >
      <span aria-hidden="true" className="text-base leading-5">{TONE_ICON[feedback.tone]}</span>
      <span className="flex-1">{feedback.text}</span>
      <button
        onClick={onDismiss}
        aria-label="Descartar aviso"
        className="shrink-0 rounded-lg px-2 text-lg leading-5 opacity-60 hover:opacity-100 transition"
      >
        ✕
      </button>
    </div>
  )
}
