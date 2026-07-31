// Formatos compartidos entre páginas. Antes cada tabla usaba toLocaleString(),
// que da "30/7/2026, 7:44:31": ancho variable, con segundos y distinto entre
// Movimientos y Egresos aunque muestren los mismos registros.

/** dd/MM/yyyy HH:mm — ancho fijo, apto para alinear en columna. */
export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Separador de miles en formato argentino: 1.250 en vez de 1250. */
export function formatNumero(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('es-AR').format(n)
}

/** Cantidad de un movimiento, con signo explícito. */
export function formatCantidad(n: number): string {
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatNumero(Math.abs(n))}`
}

/** Prefijo que deja stockCicService en counterparty al registrar egresos automáticos. */
export const ORIGEN_ACCION_SOCIAL = 'Acción Social'

export function esMovimientoAutomatico(counterparty: string | null | undefined): boolean {
  return (counterparty || '').startsWith(ORIGEN_ACCION_SOCIAL)
}

export const MOVEMENT_TYPE_LABEL: Record<string, string> = {
  donation: 'Donación',
  purchase: 'Compra',
  transfer_in: 'Transferencia recibida',
  delivery: 'Entrega',
  transfer_out: 'Transferencia',
  waste: 'Descarte',
  adjustment: 'Ajuste',
}
