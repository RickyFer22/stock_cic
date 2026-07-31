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
      ? 'bg-rose-600 hover:bg-rose-700'
      : 'bg-brand-green-900 hover:bg-brand-green-800'

  return (
    <Modal title={title} onClose={onCancel} size="sm">
      <p className="text-sm text-slate-600 font-medium leading-relaxed">{message}</p>
      <div className="pt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100 transition"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={`px-5 py-2 rounded-xl text-white font-bold disabled:opacity-50 transition ${confirmClass}`}
        >
          {loading ? 'Procesando...' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
