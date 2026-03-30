import { useEffect, ReactNode } from 'react'
import clsx from 'clsx'

interface ModalProps {
  title: string
  children: ReactNode
  onClose: () => void
  size?: 'sm' | 'md' | 'lg'
}

export default function Modal({ title, children, onClose, size = 'md' }: ModalProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const widthClass = clsx({
    'max-w-sm':  size === 'sm',
    'max-w-lg':  size === 'md',
    'max-w-2xl': size === 'lg',
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(15,23,42,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${widthClass} animate-fade-in flex flex-col max-h-[90vh]`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="font-display font-bold text-primary-900 text-xl uppercase tracking-wide">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400
                       hover:bg-slate-100 hover:text-slate-700 transition-colors text-lg"
          >
            ✕
          </button>
        </div>
        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}
