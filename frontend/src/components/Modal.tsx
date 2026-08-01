import { useEffect, useRef, type ReactNode } from 'react'
import clsx from 'clsx'

interface ModalProps {
  title: string
  children: ReactNode
  onClose: () => void
  size?: 'sm' | 'md' | 'lg'
  /**
   * Si es true, cerrar con Escape o clic fuera pide confirmación. Se usa en los
   * formularios con datos cargados: antes se descartaba lo escrito en silencio.
   */
  confirmarCierre?: boolean
}

const SELECTOR_FOCO =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Modal({ title, children, onClose, size = 'md', confirmarCierre = false }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const origenRef = useRef<HTMLElement | null>(null)

  const intentarCerrar = () => {
    if (confirmarCierre && !window.confirm('Se van a descartar los datos cargados. ¿Cerrar de todos modos?')) return
    onClose()
  }

  useEffect(() => {
    // Se recuerda quién abrió el modal para devolverle el foco al cerrar.
    origenRef.current = document.activeElement as HTMLElement

    const panel = panelRef.current
    const primero = panel?.querySelector<HTMLElement>(SELECTOR_FOCO)
    ;(primero ?? panel)?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        intentarCerrar()
        return
      }
      // Atrapado de foco: sin esto, tabular dentro del modal seguía recorriendo
      // la página de fondo, que para un lector de pantalla no existe (WCAG 2.4.3).
      if (e.key !== 'Tab' || !panel) return
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(SELECTOR_FOCO))
        .filter((el) => el.offsetParent !== null)
      if (focusables.length === 0) return
      const primero = focusables[0]
      const ultimo = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
      origenRef.current?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, confirmarCierre])

  const widthClass = clsx({
    'max-w-sm': size === 'sm',
    'max-w-lg': size === 'md',
    'max-w-2xl': size === 'lg',
  })

  const tituloId = `modal-titulo-${title.replace(/\W+/g, '-').toLowerCase()}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(15,23,42,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) intentarCerrar() }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        className={`bg-white rounded-[2rem] shadow-2xl w-full ${widthClass} animate-fade-in flex flex-col max-h-[90vh] overflow-hidden border border-slate-100`}
      >
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 shrink-0 bg-slate-50">
          <h2 id={tituloId} className="font-display font-black text-brand-green-900 text-xl uppercase tracking-wider">
            {title}
          </h2>
          <button
            onClick={intentarCerrar}
            className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green-700"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <div className="px-8 py-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}
