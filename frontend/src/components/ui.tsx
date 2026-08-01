/**
 * Componentes base del sistema. Ver design.md.
 *
 * Todos los colores salen de tokens semánticos (bg-paper, text-ink-2,
 * border-rule…), nunca de una utilidad de color cruda. Por eso el tema oscuro
 * funciona sin una sola clase `dark:`: los tokens ya cambian de valor.
 */
import type { ReactNode, ButtonHTMLAttributes } from 'react'

/* ────────────────────────── Superficie ────────────────────────── */

export function Card({ children, className = '', padded = true }: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div
      className={`bg-paper-2 border border-rule rounded-[--radius-card] shadow-[--shadow-card]
        ${padded ? 'p-4 sm:p-5' : ''} ${className}`}
    >
      {children}
    </div>
  )
}

/**
 * Encabezado de pantalla. Título en versalitas, bajada de una línea, acciones a
 * la derecha. La escala es contenida a propósito: es una aplicación de gestión y
 * el título no debe competir con los datos.
 */
export function PageHeader({ title, subtitle, actions }: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
      <div className="min-w-0">
        <h1 className="font-display font-extrabold text-ink uppercase tracking-[-0.01em] text-[length:--text-display] leading-tight">
          {title}
        </h1>
        {subtitle && <p className="text-ink-2 mt-1 text-[length:--text-base]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-[length:--text-xs] font-bold text-ink-3 uppercase tracking-wide mb-1.5"
    >
      {children}
    </label>
  )
}

/** Campo de texto y selector comparten ritmo: mismo alto, mismo radio, mismo foco. */
export const campoClases =
  `w-full rounded-[--radius-input] border border-rule bg-paper text-ink
   px-3.5 py-2.5 text-[length:--text-base] outline-none
   placeholder:text-ink-3
   focus:border-focus focus-visible:outline focus-visible:outline-2
   focus-visible:outline-offset-1 focus-visible:outline-focus
   disabled:opacity-50 disabled:cursor-not-allowed
   transition-colors duration-[--dur-fast]`

/* ────────────────────────── Acciones ────────────────────────── */

type Variante = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANTE: Record<Variante, string> = {
  // El relleno primario usa accent-strong (9:1 sobre su texto). El 700 original
  // no alcanzaba para texto normal.
  primary:   'bg-accent-strong text-accent-ink border-transparent hover:brightness-110',
  secondary: 'bg-paper text-ink-2 border-rule hover:border-rule-strong hover:text-ink',
  // Destructiva en contorno: el relleno rojo se reserva para la confirmación
  // dentro del diálogo, donde la acción ya es inminente.
  danger:    'bg-transparent text-state-danger border-state-danger hover:bg-state-danger-bg',
  ghost:     'bg-transparent text-ink-2 border-transparent hover:bg-paper-3 hover:text-ink',
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
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2
        min-h-[2.75rem] px-4 py-2.5 rounded-[--radius-input] border
        font-body font-bold uppercase tracking-wide text-[length:--text-sm]
        whitespace-nowrap
        transition-[background-color,border-color,color,filter] duration-[--dur-fast] ease-[--ease-out]
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus
        ${VARIANTE[variant]} ${className}`}
    >
      {loading ? 'Procesando…' : children}
    </button>
  )
}

/* ────────────────────────── Estado ────────────────────────── */

type Tono = 'ok' | 'warn' | 'danger' | 'info' | 'neutral'

const TONO: Record<Tono, string> = {
  ok:      'bg-state-ok-bg text-state-ok border-state-ok/25',
  warn:    'bg-state-warn-bg text-state-warn border-state-warn/25',
  danger:  'bg-state-danger-bg text-state-danger border-state-danger/25',
  info:    'bg-state-info-bg text-state-info border-state-info/25',
  neutral: 'bg-paper-3 text-ink-2 border-rule',
}

/**
 * Pastilla de estado. Siempre teñida, nunca rellena: si el estado "ok" fuera un
 * relleno verde competiría con la acción primaria, que es el otro verde de la
 * pantalla. Y siempre lleva su etiqueta de texto — el color no comunica solo.
 */
export function Badge({ tone = 'neutral', children }: { tone?: Tono; children: ReactNode }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-[--radius-pill] border
        text-[length:--text-xs] font-bold uppercase tracking-wide ${TONO[tone]}`}
    >
      {children}
    </span>
  )
}

/* ────────────────────────── Tabla ────────────────────────── */

/**
 * Tabla con encabezado fijo. Por debajo de 900 px cada fila se apila como
 * tarjeta con etiquetas (ver .table-responsive en styles.css): en un teléfono,
 * arrastrar en horizontal para leer una fila no es leer.
 */
export function TableWrap({ children, maxHeight = '65vh' }: { children: ReactNode; maxHeight?: string }) {
  return (
    <div className="bg-paper-2 border border-rule rounded-[--radius-card] shadow-[--shadow-card] overflow-hidden">
      <div className="table-responsive overflow-auto scrollbar-hide" style={{ maxHeight }}>
        {children}
      </div>
    </div>
  )
}

export function Th({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 sticky top-0 z-10 bg-paper-3 text-ink-2 border-b border-rule
        font-bold text-[length:--text-xs] uppercase tracking-wide
        ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      {children}
    </th>
  )
}

/** Celda numérica: tabular-nums obligatorio o los dígitos bailan al paginar. */
export function TdNum({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-right tabular-nums text-ink ${className}`}>{children}</td>
}

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
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-rule bg-paper-2">
      <span className="text-[length:--text-xs] font-bold text-ink-3 uppercase tracking-wide tabular-nums">
        Mostrando {desde}–{hasta} de {total.toLocaleString('es-AR')}{extra ? ` · ${extra}` : ''}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" className="min-h-0 px-3 py-1.5 text-[length:--text-xs]"
          disabled={page <= 1} onClick={() => onChange(Math.max(1, page - 1))}>
          Anterior
        </Button>
        <span className="text-[length:--text-sm] font-bold text-ink-2 tabular-nums">{page} / {totalPages}</span>
        <Button variant="secondary" className="min-h-0 px-3 py-1.5 text-[length:--text-xs]"
          disabled={page >= totalPages} onClick={() => onChange(Math.min(totalPages, page + 1))}>
          Siguiente
        </Button>
      </div>
    </div>
  )
}
