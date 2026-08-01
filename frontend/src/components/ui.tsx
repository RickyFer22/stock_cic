/**
 * Componentes base del sistema.
 *
 * Antes cada pantalla repetía literalmente las mismas cadenas de utilidades:
 * `bg-white/80 backdrop-blur-md rounded-[2rem] border border-white/60` aparecía
 * 16 veces, `px-5 py-2.5 rounded-xl` otras 15. Cualquier ajuste visual obligaba
 * a editar siete archivos y a acertar en todos. Eso —y no el color— es la causa
 * de la inconsistencia entre módulos.
 */
import type { ReactNode, ButtonHTMLAttributes } from 'react'

/* ────────────────────────── Superficie ────────────────────────── */

export function Card({ children, className = '', padded = true }: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div className={`bg-white/80 backdrop-blur-md border border-white/60 rounded-3xl shadow-card ${padded ? 'p-5' : ''} ${className}`}>
      {children}
    </div>
  )
}

/** Encabezado de pantalla: título, bajada y acciones. */
export function PageHeader({ title, subtitle, actions }: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display font-black text-brand-green-900 text-3xl uppercase tracking-wider">{title}</h1>
        {subtitle && <p className="text-slate-600 mt-1 font-medium text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Etiqueta de sección en versalitas, repetida 28 veces en el código anterior. */
export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">
      {children}
    </label>
  )
}

/* ────────────────────────── Botones ────────────────────────── */

type Variante = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANTE: Record<Variante, string> = {
  primary:   'bg-brand-green-900 text-white border-transparent hover:bg-brand-green-800',
  secondary: 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300',
  danger:    'bg-rose-600 text-white border-transparent hover:bg-rose-700',
  ghost:     'bg-transparent text-slate-600 border-transparent hover:bg-slate-100',
}

export function Button({
  variant = 'secondary',
  loading = false,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variante; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border-2
        font-bold uppercase tracking-wide text-sm whitespace-nowrap transition-all
        disabled:opacity-50 disabled:cursor-not-allowed
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green-700
        ${VARIANTE[variant]} ${className}`}
    >
      {loading ? 'Procesando…' : children}
    </button>
  )
}

/* ────────────────────────── Estado ────────────────────────── */

type Tono = 'ok' | 'warn' | 'danger' | 'info' | 'neutral'

const TONO: Record<Tono, string> = {
  ok:      'bg-emerald-100 text-emerald-800 border-emerald-200',
  warn:    'bg-amber-100 text-amber-800 border-amber-200',
  danger:  'bg-rose-100 text-rose-800 border-rose-200',
  info:    'bg-sky-100 text-sky-800 border-sky-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
}

/**
 * El estado se comunica con texto, no solo con color: es requisito de WCAG 1.4.1
 * y además sobrevive a la impresión en blanco y negro, que en oficina ocurre.
 */
export function Badge({ tone = 'neutral', children }: { tone?: Tono; children: ReactNode }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${TONO[tone]}`}>
      {children}
    </span>
  )
}

/* ────────────────────────── Tabla ────────────────────────── */

/**
 * Envoltorio de tabla con encabezado fijo y, por debajo de 900px, filas apiladas
 * como tarjetas. Cada celda debe llevar `data-label` con el nombre de su columna
 * (ver .table-responsive en styles.css).
 */
export function TableWrap({ children, maxHeight = '65vh' }: { children: ReactNode; maxHeight?: string }) {
  return (
    <div className="bg-white/80 backdrop-blur-md border border-white/60 rounded-3xl shadow-card overflow-hidden">
      <div className="table-responsive overflow-auto scrollbar-hide" style={{ maxHeight }}>
        {children}
      </div>
    </div>
  )
}

export function Th({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' }) {
  return (
    <th scope="col" className={`px-5 py-4 font-bold sticky top-0 bg-slate-100 z-10 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}

/** Pie de tabla con rango visible y navegación entre páginas. */
export function Pager({ page, totalPages, total, pageSize, onChange, extra }: {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onChange: (p: number) => void
  extra?: string
}) {
  const desde = total === 0 ? 0 : (page - 1) * pageSize + 1
  const hasta = Math.min(page * pageSize, total)
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-slate-100 bg-white/60">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
        Mostrando {desde}–{hasta} de {total.toLocaleString('es-AR')}{extra ? ` · ${extra}` : ''}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" className="px-3 py-2 text-xs" disabled={page <= 1} onClick={() => onChange(Math.max(1, page - 1))}>
          Anterior
        </Button>
        <span className="text-sm font-bold text-slate-600 tabular-nums">{page} / {totalPages}</span>
        <Button variant="secondary" className="px-3 py-2 text-xs" disabled={page >= totalPages} onClick={() => onChange(Math.min(totalPages, page + 1))}>
          Siguiente
        </Button>
      </div>
    </div>
  )
}
