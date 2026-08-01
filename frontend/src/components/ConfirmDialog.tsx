import Modal from './Modal'

/**
 * Confirmación dentro del sistema, en reemplazo del confirm() nativo: bloqueante
 * a nivel de ventana, sin estilo propio y con botones que no explican qué hacen.
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'normal'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const confirmClass =
    tone === 'danger'
      ? 'bg-state-danger hover:brightness-110'
      : 'bg-accent-strong hover:brightness-110'

  return (
    <Modal title={title} onClose={onCancel} size="sm">
      <p className="text-sm text-ink-2 font-medium leading-relaxed">{message}</p>
      <div className="pt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-ink-2 font-semibold hover:bg-paper-3 transition"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`px-5 py-2 rounded-xl text-paper font-bold disabled:opacity-50 transition ${confirmClass}`}
        >
          {loading ? 'Procesando...' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
