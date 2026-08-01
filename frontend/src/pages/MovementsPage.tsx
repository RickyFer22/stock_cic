import { useCallback, useEffect, useMemo, useState } from 'react'
import EmptyState from '../components/EmptyState'
import HowToCard from '../components/HowToCard'
import { apiDownload, apiGet } from '../api/client'

type MovementRow = {
  id: string
  fecha: string
  kind: string
  movement_type: string | null
  quantity: number
  counterparty: string | null
  notes: string | null
  code: string
  item_name: string
  operador: string
}

type Pagination = { page: number; limit: number; total: number; totalPages: number }

type KindFilter = 'all' | 'INGRESO' | 'DISTRIBUTION' | 'ADJUSTMENT'

const PAGE_SIZE = 50

// Prefijo que deja stockCicService al registrar egresos disparados por una asistencia.
const ORIGEN_ACCION_SOCIAL = 'Acción Social'

const MOVEMENT_TYPE_LABEL: Record<string, string> = {
  donation: 'Donación',
  purchase: 'Compra',
  transfer_in: 'Transferencia recibida',
  delivery: 'Entrega',
  transfer_out: 'Transferencia',
  waste: 'Descarte',
  adjustment: 'Ajuste',
}

// toLocaleString() da "30/7/2026, 7:44:31": ancho variable y con segundos, ilegible
// en columna. Formato fijo dd/MM/yyyy HH:mm.
function formatFecha(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function esAutomático(row: MovementRow) {
  return (row.counterparty || '').startsWith(ORIGEN_ACCION_SOCIAL)
}

export default function MovementsPage() {
  const [rows, setRows] = useState<MovementRow[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [soloAutomáticos, setSoloAutomáticos] = useState(false)
  const [page, setPage] = useState(1)

  // Los filtros de tipo y fecha viajan a la API: filtrarlos en el cliente solo
  // acotaba la página cargada, dejando fuera todo el historial anterior.
  const queryString = useCallback((extra?: Record<string, string>) => {
    const params = new URLSearchParams()
    if (kindFilter !== 'all') params.set('kind', kindFilter)
    if (from) params.set('from', from)
    if (to) params.set('to', `${to}T23:59:59`)
    Object.entries(extra || {}).forEach(([k, v]) => params.set(k, v))
    return params.toString()
  }, [kindFilter, from, to])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const qs = queryString({ page: String(page), limit: String(PAGE_SIZE) })
    apiGet<{ data: MovementRow[]; pagination: Pagination }>(`/api/movements?${qs}`)
      .then((res) => {
        if (cancelled) return
        setRows(res.data)
        setPagination(res.pagination)
      })
      .catch((e) => { if (!cancelled) setError(e.message || 'Error') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [queryString, page])

  // Al cambiar cualquier filtro volvemos a la primera página, para no quedar en
  // una página que ya no existe en el nuevo conjunto de resultados.
  useEffect(() => { setPage(1) }, [kindFilter, from, to])

  // La búsqueda por texto sí es local: acota la página visible sin ir al servidor.
  const visibleRows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (soloAutomáticos && !esAutomático(row)) return false
      if (!needle) return true
      return [row.code, row.item_name, row.operador, row.counterparty ?? '', row.notes ?? '']
        .some((value) => String(value).toLowerCase().includes(needle))
    })
  }, [rows, search, soloAutomáticos])

  async function handleExport() {
    setDownloading(true)
    try {
      await apiDownload(`/api/export/movements.xlsx?${queryString()}`, 'movimientos_san_roque.xlsx')
    } catch {
      setError('No se pudo generar el Excel.')
    } finally {
      setDownloading(false)
    }
  }

  const total = pagination?.total ?? 0
  const totalPages = pagination?.totalPages ?? 1
  const desde = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const hasta = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-extrabold text-ink text-3xl uppercase tracking-wider">Movimientos</h1>
          <p className="text-ink-2 mt-1 font-medium text-sm">Seguimiento de ingresos, egresos y ajustes de stock.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={downloading || total === 0}
            className="px-4 py-2.5 rounded-xl bg-accent-strong text-accent-ink text-sm font-bold uppercase tracking-wider disabled:opacity-50 hover:brightness-110 transition"
          >
            {downloading ? 'Generando...' : 'Exportar Excel'}
          </button>
          <div className="px-4 py-2.5 rounded-xl bg-paper border-2 border-rule shadow-sm text-sm text-ink-2 font-bold uppercase tracking-wider">
            Total: <b className="text-accent text-base">{total}</b>
          </div>
        </div>
      </div>

      <HowToCard
        title="Guía rápida de movimientos"
        steps={[
          'Paso 1: acota por tipo y rango de fechas; los filtros se aplican sobre todo el historial.',
          'Paso 2: busca por codigo, articulo, operador, origen/destino o nota.',
          'Paso 3: usa "Solo automáticos" para conciliar los egresos que llegan de Acción Social.',
        ]}
      />

      <div className="bg-paper-2 border border-rule rounded-[--radius-card] p-4 shadow-sm flex flex-col gap-3">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por código, artículo, operador, origen/destino o nota..."
            className="w-full md:flex-1 rounded-xl border border-rule bg-paper px-4 py-2.5 text-sm outline-none focus:border-focus"
          />
          <select
            value={kindFilter}
            onChange={(event) => setKindFilter(event.target.value as KindFilter)}
            className="w-full md:w-52 rounded-xl border border-rule bg-paper px-4 py-2.5 text-sm font-semibold outline-none focus:border-focus"
          >
            <option value="all">Todos los tipos</option>
            <option value="INGRESO">Ingresos</option>
            <option value="DISTRIBUTION">Egresos</option>
            <option value="ADJUSTMENT">Ajustes</option>
          </select>
        </div>
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <label className="flex items-center gap-2 text-sm text-ink-2 font-semibold">
            Desde
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="rounded-xl border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-focus"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-2 font-semibold">
            Hasta
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="rounded-xl border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-focus"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-2 font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={soloAutomáticos}
              onChange={(event) => setSoloAutomáticos(event.target.checked)}
              className="h-4 w-4 rounded border-rule accent-[--color-accent]"
            />
            Solo automáticos (Acción Social)
          </label>
          {(from || to || kindFilter !== 'all' || soloAutomáticos || search) && (
            <button
              onClick={() => { setFrom(''); setTo(''); setKindFilter('all'); setSoloAutomáticos(false); setSearch('') }}
              className="md:ml-auto text-sm font-bold text-ink-3 hover:text-ink underline underline-offset-2"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <EmptyState icon="⏳" message="Cargando" sub="Buscando movimientos..." />
      ) : error ? (
        <EmptyState icon="⚠️" message="Error" sub={error} />
      ) : !total ? (
        <EmptyState message="Sin movimientos" sub="No hay registros para los filtros elegidos." />
      ) : !visibleRows.length ? (
        <EmptyState message="Sin resultados" sub="Ajustá la búsqueda para ver movimientos de esta página." />
      ) : (
        <div className="bg-paper-2 border border-rule rounded-[--radius-card] shadow-[--shadow-card] overflow-hidden">
          <div className="overflow-auto scrollbar-hide">
            <table className="min-w-full text-sm">
              <thead className="bg-paper-3">
                <tr className="text-left text-ink-3 uppercase tracking-wider text-xs">
                  <th className="px-5 py-4 font-bold">Fecha</th>
                  <th className="px-5 py-4 font-bold">Tipo</th>
                  <th className="px-5 py-4 font-bold">Artículo</th>
                  <th className="px-5 py-4 font-bold text-right">Cantidad</th>
                  <th className="px-5 py-4 font-bold">Origen / Destino</th>
                  <th className="px-5 py-4 font-bold">Operador</th>
                  <th className="px-5 py-4 font-bold">Notas</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => (
                  <tr key={r.id} className="border-t border-rule hover:bg-paper-3 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap text-ink-2 font-medium tabular-nums">{formatFecha(r.fecha)}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-block px-2 py-1.5 rounded-lg text-[10px] uppercase font-black tracking-widest ${
                        r.kind === 'INGRESO' ? 'bg-state-ok-bg text-state-ok' :
                        r.kind === 'DISTRIBUTION' ? 'bg-state-danger-bg text-state-danger' :
                        r.kind === 'ADJUSTMENT' ? 'bg-state-warn-bg text-state-warn' :
                        'bg-paper-3 text-ink'
                      }`}>
                        {r.kind === 'DISTRIBUTION' ? 'EGRESO' : r.kind}
                      </span>
                      {r.movement_type && (
                        <span className="block mt-1 text-[11px] text-ink-3 font-semibold">
                          {MOVEMENT_TYPE_LABEL[r.movement_type] || r.movement_type}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="block font-mono text-[11px] text-state-info font-bold tracking-wide">{r.code}</span>
                      <span className="block font-semibold text-ink">{r.item_name}</span>
                    </td>
                    <td className={`px-5 py-4 text-right font-black text-base tabular-nums ${r.quantity > 0 ? 'text-state-ok' : 'text-state-danger'}`}>
                      {r.quantity > 0 ? '+' : ''}{r.quantity}
                    </td>
                    <td className="px-5 py-4 text-ink-2 font-medium">
                      {r.counterparty || <span className="text-ink-3">—</span>}
                      {esAutomático(r) && (
                        <span className="block mt-1 text-[10px] uppercase font-black tracking-widest text-state-info">
                          Automático
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-ink-2 font-medium">{r.operador}</td>
                    <td className="px-5 py-4 text-ink-3 max-w-[220px] truncate" title={r.notes || ''}>{r.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-rule bg-paper-2">
            <span className="text-xs font-semibold text-ink-3 uppercase tracking-wider">
              Mostrando {desde}–{hasta} de {total}
              {search || soloAutomáticos ? ` · ${visibleRows.length} en pantalla tras filtrar` : ''}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-2 rounded-lg border border-rule bg-paper text-sm font-bold text-ink-2 disabled:opacity-40 hover:bg-paper-3 transition"
              >
                Anterior
              </button>
              <span className="text-sm font-bold text-ink-2 tabular-nums">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-2 rounded-lg border border-rule bg-paper text-sm font-bold text-ink-2 disabled:opacity-40 hover:bg-paper-3 transition"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
