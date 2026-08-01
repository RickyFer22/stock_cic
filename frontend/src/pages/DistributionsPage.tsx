import { useEffect, useMemo, useState } from 'react'
import EmptyState from '../components/EmptyState'
import HowToCard from '../components/HowToCard'
import Modal from '../components/Modal'
import Banner, { type Feedback } from '../components/Banner'
import { apiDownload, apiGet, apiPost } from '../api/client'
import { esMovimientoAutomatico, formatFecha, formatNumero, MOVEMENT_TYPE_LABEL } from '../lib/format'

type Pagination = { page: number; limit: number; total: number; totalPages: number }

const PAGE_SIZE = 50

type OutboundMovementRow = {
  id: string
  fecha: string
  movement_type: string
  counterparty: string | null
  notes: string | null
  operador: string
}

type OutboundMovementDetail = {
  id: string
  fecha: string
  movement_type: string
  counterparty: string | null
  notes: string | null
  operador: string
  items: Array<{ name: string; code: string; unit: string; quantity: number }>
}

export default function DistributionsPage() {
  const [rows, setRows] = useState<OutboundMovementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<OutboundMovementDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'delivery' | 'transfer_out' | 'waste' | 'adjustment'>('all')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)

  // Creation form state
  const [showForm, setShowForm] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [destination, setDestination] = useState('')
  const [movementType, setMovementType] = useState('delivery')
  const [observaciones, setObservaciones] = useState('')
  
  // Available items for selection
  const [availableItems, setAvailableItems] = useState<Array<{id:string, name:string, stock_actual:number, unit:string}>>([])
  const [selectedItems, setSelectedItems] = useState<Array<{item_id:string, quantity:number, name:string}>>([])
  const [pendingItemId, setPendingItemId] = useState('')

  // Se pagina contra la API. Antes se pedia limit=100 sin paginar: pasados los 100
  // egresos los mas viejos desaparecian de la pantalla sin ningun aviso, y ahora
  // que Accion Social genera egresos automaticos ese techo se alcanza rapido.
  async function loadDistributions(pagina = page) {
    setLoading(true)
    try {
      const data = await apiGet<{ data: any[]; pagination: Pagination }>(
        `/api/movements?kind=OUTBOUND&page=${pagina}&limit=${PAGE_SIZE}`,
      )
      setRows(data.data)
      setPagination(data.pagination)
    } catch (e: any) {
      setError(e.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDistributions(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  // Load items when form opens
  useEffect(() => {
    if (showForm && availableItems.length === 0) {
      apiGet<{ data: any[] }>('/api/items')
        .then(res => setAvailableItems(res.data))
        .catch(console.error)
    }
  }, [showForm])

  async function handleExportExcel() {
    try {
      setExporting(true)
      await apiDownload('/api/export/movements.xlsx?kind=OUTBOUND', 'egresos_san_roque.xlsx')
      setFeedback({ tone: 'success', text: 'Listado de egresos descargado.' })
    } catch (e: any) {
      setFeedback({ tone: 'error', text: `No se pudo exportar: ${e.message || 'error desconocido'}` })
    } finally {
      setExporting(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!destination) return setFormError('Debe indicar un destino/beneficiario.')
    if (selectedItems.length === 0) return setFormError('Debe agregar al menos un artículo.')

    setFormError(null)
    setFormLoading(true)
    try {
      // El endpoint espera "destination", no "counterparty": enviarlo mal hacia que
      // el formulario devolviera 400 siempre y ningun egreso manual pudiera cargarse.
      await apiPost('/api/stock/outbound', {
        destination,
        movement_type: movementType,
        notes: observaciones || undefined,
        items: selectedItems.map(it => ({ item_id: it.item_id, quantity: it.quantity }))
      })
      setShowForm(false)
      setFeedback({ tone: 'success', text: `Egreso registrado: ${selectedItems.length} artículo(s) a ${destination}.` })
      loadDistributions()
      // reset form
      setDestination('')
      setMovementType('delivery')
      setSelectedItems([])
      setObservaciones('')
    } catch (err: any) {
      setFormError(err.message || 'Error registrando egreso')
    } finally {
      setFormLoading(false)
    }
  }

  // Deshabilitar el detalle pop-up ya que cambiamos la lógica de agrupado a por movimiento individual.
  // o arreglarlo de otra forma. Para mantener simple, podemos borrar el effect de detalle.

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    setDetailLoading(true)
    apiGet<{ data: OutboundMovementDetail }>(`/api/movements/${selectedId}`)
      .then((data) => { if (!cancelled) setDetail(data.data) })
      .catch((e) => { if (!cancelled) setError(e.message || 'Error') })
      .finally(() => { if (!cancelled) setDetailLoading(false) })
    return () => { cancelled = true }
  }, [selectedId])

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesType = typeFilter === 'all' || row.movement_type === typeFilter
      if (!matchesType) return false
      if (!needle) return true
      return [
        row.counterparty ?? '',
        row.notes ?? '',
        row.operador ?? '',
      ].some((value) => String(value).toLowerCase().includes(needle))
    })
  }, [rows, search, typeFilter])

  const header = useMemo(() => {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-display font-extrabold text-ink text-3xl uppercase tracking-wider">Egresos</h1>
            <p className="text-ink-2 mt-1 font-medium text-sm">Registro de mercadería entregada, descartada o transferida.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            {/* Acción principal destacada */}
            <button
              onClick={() => setShowForm(true)}
              data-tip="Cargar una salida de mercadería del depósito"
              className="px-5 py-2.5 rounded-xl bg-accent-strong text-accent-ink font-bold tracking-wide uppercase text-sm hover:brightness-110 shadow-md hover:shadow-lg transition-all order-first sm:order-none"
            >
              + Registrar egreso
            </button>
            <div className="w-px h-8 bg-rule hidden sm:block" aria-hidden />
            {/* Resumen y exportación */}
            <div className="px-4 py-2.5 rounded-xl bg-paper-3 text-ink-2 text-sm font-bold uppercase tracking-wider">
              Total: <span className="text-accent text-base">{formatNumero(pagination?.total ?? 0)}</span>
            </div>
            <button
              onClick={handleExportExcel}
              data-tip="Descargar el listado completo de egresos en Excel"
              disabled={exporting || !rows.length}
              className="px-5 py-2.5 rounded-xl bg-paper border-2 border-rule shadow-sm text-xs sm:text-sm text-ink-2 font-bold uppercase tracking-wider hover:bg-paper-3 hover:border-rule-strong transition-all disabled:opacity-60"
            >
              {exporting ? 'Exportando…' : 'Exportar Excel'}
            </button>
          </div>
        </div>
      </div>
    )
  }, [pagination, rows.length, exporting])

  // Solo la carga inicial reemplaza la pantalla. Al pasar de pagina se conservan
  // filtros y busqueda: desmontarlos en cada consulta hacia perder el contexto.
  if (loading && !pagination) return <EmptyState icon="⏳" message="Cargando" sub="Buscando registros..." />
  if (error) return <EmptyState icon="⚠️" message="Error" sub={error} />

  return (
    <div className="space-y-5">
      {header}
      <Banner feedback={feedback} onDismiss={() => setFeedback(null)} />
      <HowToCard
        title="Guia rapida de egresos"
        steps={[
          'Paso 1: toca "+ Registrar egreso".',
          'Paso 2: completa tipo, destino y articulos.',
          'Paso 3: confirma y revisa el detalle tocando una fila.',
          'Los egresos marcados "Automatico" los genera Accion Social al registrar una asistencia.',
        ]}
      />

      <div className="bg-paper-2 border border-rule rounded-[--radius-card] p-4 shadow-sm flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por destino, operador u observación..."
          className="w-full md:max-w-xl rounded-xl border border-rule bg-paper px-4 py-2.5 text-sm outline-none focus:border-focus"
        />
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as 'all' | 'delivery' | 'transfer_out' | 'waste' | 'adjustment')}
          className="w-full md:w-64 rounded-xl border border-rule bg-paper px-4 py-2.5 text-sm font-semibold outline-none focus:border-focus"
        >
          <option value="all">Todos los tipos</option>
          <option value="delivery">Entrega</option>
          <option value="transfer_out">Transferencia</option>
          <option value="waste">Descarte</option>
          <option value="adjustment">Ajuste</option>
        </select>
      </div>
      
      {!rows.length ? (
        <EmptyState message="Sin egresos" sub="No hay registros cargados aún." />
      ) : !filteredRows.length ? (
        <EmptyState message="Sin resultados" sub="Ajustá la búsqueda o los filtros para ver egresos." />
      ) : (
      <div className="bg-paper-2 border border-rule rounded-[--radius-card] shadow-[--shadow-card] overflow-hidden">
        <div className="overflow-auto scrollbar-hide">
          <table className="min-w-full text-sm">
            <thead className="bg-paper-3">
              <tr className="text-left text-ink-3 uppercase tracking-wider text-xs">
                <th className="px-5 py-4 font-bold">Fecha</th>
                <th className="px-5 py-4 font-bold">Tipo</th>
                <th className="px-5 py-4 font-bold">Destino / Observación</th>
                <th className="px-5 py-4 font-bold">Operador</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-rule hover:bg-paper-3 transition-colors cursor-pointer focus-within:bg-paper-2"
                  onClick={() => setSelectedId(r.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(r.id) } }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Ver detalle del egreso del ${formatFecha(r.fecha)} a ${r.counterparty || 'destino sin especificar'}`}
                >
                  <td className="px-5 py-4 whitespace-nowrap text-ink-2 font-medium tabular-nums">{formatFecha(r.fecha)}</td>
                  <td className="px-5 py-4 text-ink-2 font-bold">
                    {MOVEMENT_TYPE_LABEL[r.movement_type] || r.movement_type}
                  </td>
                  <td className="px-5 py-4 text-ink-2 font-semibold">
                    {r.counterparty || <span className="text-ink-3 font-normal">Sin destino</span>}
                    {r.notes && <span className="text-ink-3 font-normal ml-2">{r.notes}</span>}
                    {esMovimientoAutomatico(r.counterparty) && (
                      <span className="block mt-1 text-[10px] uppercase font-black tracking-widest text-state-info">
                        Automático · Acción Social
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-ink-3 font-medium">{r.operador}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-rule bg-paper-2">
          <span className="text-xs font-semibold text-ink-3 uppercase tracking-wider">
            Mostrando {pagination?.total ? (page - 1) * PAGE_SIZE + 1 : 0}–
            {Math.min(page * PAGE_SIZE, pagination?.total ?? 0)} de {formatNumero(pagination?.total ?? 0)}
            {search || typeFilter !== 'all' ? ` · ${filteredRows.length} en pantalla tras filtrar` : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="px-3 py-2 rounded-lg border border-rule bg-paper text-sm font-bold text-ink-2 disabled:opacity-40 hover:bg-paper-3 transition"
            >
              Anterior
            </button>
            <span className="text-sm font-bold text-ink-2 tabular-nums">{page} / {pagination?.totalPages ?? 1}</span>
            <button
              onClick={() => setPage((p) => Math.min(pagination?.totalPages ?? 1, p + 1))}
              disabled={page >= (pagination?.totalPages ?? 1) || loading}
              className="px-3 py-2 rounded-lg border border-rule bg-paper text-sm font-bold text-ink-2 disabled:opacity-40 hover:bg-paper-3 transition"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
      )}

      {selectedId && (
        <Modal
          title={detail ? `Egreso ${detail.id.slice(0, 8).toUpperCase()}` : 'Detalle de egreso'}
          onClose={() => { setSelectedId(null); setDetail(null) }}
          size="lg"
        >
          {detailLoading || !detail ? (
            <EmptyState icon="⏳" message="Cargando" sub="Leyendo detalle..." />
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-rule bg-paper-2 p-4">
                <div className="flex flex-wrap gap-3 justify-between">
                  <div>
                    <div className="text-xs text-ink-3 uppercase tracking-wide">Tipo de Egreso</div>
                    <div className="text-ink font-semibold text-lg">
                      {detail.movement_type === 'delivery' ? 'Entrega (Asistencia)' : detail.movement_type === 'transfer_out' ? 'Transferencia / Pase' : detail.movement_type === 'waste' ? 'Descarte (Vencido/Roto)' : 'Ajuste de Stock'}
                    </div>
                    <div className="text-sm text-ink-2">Destino: <b>{detail.counterparty}</b></div>
                    {detail.notes && <div className="text-sm text-ink-2">Notas: <b>{detail.notes}</b></div>}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-ink-3 uppercase tracking-wide">Fecha</div>
                    <div className="text-ink font-semibold">{formatFecha(detail.fecha)}</div>
                    <div className="text-sm text-ink-2">Operador: <b>{detail.operador}</b></div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-ink-2">
                  Artículos: <b className="text-ink">{detail.items.length}</b>
                </div>
                <button
                  onClick={async () => {
                    const mod = await import('../lib/pdf')
                    // Assuming generateDistributionPDF can handle the new detail structure or a new function is needed
                    // For now, keeping the old function call, but it might need adaptation.
                    mod.generateDistributionPDF(detail)
                  }}
                  className="px-5 py-2.5 rounded-xl bg-accent-strong text-accent-ink font-bold tracking-wide hover:brightness-110 hover:shadow-md transition-all uppercase text-sm"
                >
                  Exportar PDF
                </button>
              </div>

              <div className="border border-rule rounded-xl overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead className="bg-paper">
                    <tr className="text-left text-ink-2">
                      <th className="px-3 py-2 font-semibold">Código</th>
                      <th className="px-3 py-2 font-semibold">Artículo</th>
                      <th className="px-3 py-2 font-semibold">Unidad</th>
                      <th className="px-3 py-2 font-semibold text-right">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((it) => (
                      <tr key={`${it.code}-${it.name}`} className="border-t border-rule">
                        <td className="px-3 py-2 font-semibold text-state-info">{it.code}</td>
                        <td className="px-3 py-2 text-ink">{it.name}</td>
                        <td className="px-3 py-2 text-ink-2">{it.unit}</td>
                        <td className="px-3 py-2 text-right font-semibold text-ink tabular-nums">{formatNumero(it.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Modal>
      )}

      {showForm && (
        <Modal title="Registrar Egreso" onClose={() => setShowForm(false)} size="lg">
          <form onSubmit={handleCreate} className="space-y-6">
            
            <div className="p-4 bg-paper-2 border border-rule rounded-[--radius-card]">
              <h3 className="text-sm font-bold text-ink-2 uppercase tracking-wide mb-3">1. Detalles del Egreso</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <label className="block">
                    <span className="text-xs font-bold text-ink-3 uppercase tracking-wide">Tipo de Egreso</span>
                    <select
                      value={movementType}
                      onChange={e => setMovementType(e.target.value)}
                      className="mt-1 block w-full rounded-xl border border-rule px-4 py-2 focus:ring-2 focus:outline-focus focus:border-focus outline-none"
                    >
                      <option value="delivery">Entrega (Asistencia)</option>
                      <option value="transfer_out">Transferencia / Pase</option>
                      <option value="waste">Descarte (Vencido/Roto)</option>
                      <option value="adjustment">Ajuste de Stock</option>
                    </select>
                 </label>
                 <label className="block">
                    <span className="text-xs font-bold text-ink-3 uppercase tracking-wide">Destino / Entidad</span>
                    <input
                      required
                      value={destination}
                      onChange={e => setDestination(e.target.value)}
                      placeholder="Ej. Comedor, Persona, Área..."
                      className="mt-1 block w-full rounded-xl border border-rule px-4 py-2 focus:ring-2 focus:outline-focus focus:border-focus outline-none"
                    />
                 </label>
              </div>
            </div>

            {/* Items Selection */}
            <div className="p-4 bg-paper-2 border border-rule rounded-[--radius-card]">
              <h3 className="text-sm font-bold text-ink-2 uppercase tracking-wide mb-3">2. Artículos a entregar</h3>
              <div className="flex gap-2 mb-4">
                 <select
                   value={pendingItemId}
                   onChange={(event) => setPendingItemId(event.target.value)}
                   className="flex-1 rounded-xl border border-rule px-4 py-2 focus:ring-2 focus:outline-focus focus:border-focus outline-none"
                 >
                    <option value="">-- Seleccionar artículo --</option>
                    {availableItems.filter(i => !selectedItems.find(s => s.item_id === i.id)).map(i => (
                      <option key={i.id} value={i.id}>{i.name} ({i.stock_actual} disp.)</option>
                    ))}
                 </select>
                 <button 
                  type="button"
                  disabled={!pendingItemId}
                  onClick={() => {
                    const item = availableItems.find(i => i.id === pendingItemId);
                    if (item) {
                      setSelectedItems([...selectedItems, { item_id: item.id, name: item.name, quantity: 1 }])
                      setPendingItemId('')
                    }
                  }}
                  className="px-4 py-2 bg-ink text-paper rounded-xl font-bold uppercase tracking-wide text-xs hover:bg-ink-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   Añadir
                 </button>
              </div>

              {selectedItems.length > 0 && (
                <div className="bg-paper rounded-xl border border-rule overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-paper-3">
                      <tr>
                        <th className="px-3 py-2 font-bold text-ink-2">Artículo</th>
                        <th className="px-3 py-2 font-bold text-ink-2 w-24">Cantidad</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.map((sit, idx) => (
                        <tr key={sit.item_id} className="border-t border-rule">
                          <td className="px-3 py-2 font-semibold text-ink">{sit.name}</td>
                          <td className="px-3 py-2">
                            <input 
                              type="number" min="1" required
                              value={sit.quantity}
                              onChange={e => {
                                const newItems = [...selectedItems]
                                newItems[idx].quantity = parseInt(e.target.value) || 1
                                setSelectedItems(newItems)
                              }}
                              className="w-full border border-rule rounded px-2 py-1 outline-none text-center"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button type="button" onClick={() => setSelectedItems(selectedItems.filter(i => i.item_id !== sit.item_id))} className="text-red-500 hover:text-red-700 font-bold px-2 py-1 rounded hover:bg-red-50 text-xs uppercase">
                              Quitar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <label className="block px-1">
              <span className="text-xs font-bold text-ink-3 uppercase tracking-wide">Observaciones (Opcional)</span>
              <input
                value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-rule px-4 py-2 focus:ring-2 focus:outline-focus focus:border-focus outline-none"
                placeholder="Motivo de la entrega o nota adicional..."
              />
            </label>

            {formError && (
               <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                 {formError}
               </div>
            )}

            <div className="pt-4 flex justify-end gap-3 border-t border-rule mt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-xl text-ink-2 font-semibold hover:bg-paper-3 transition tracking-wide"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 rounded-xl bg-accent-strong text-accent-ink font-bold tracking-widest disabled:opacity-50 hover:brightness-110 transition uppercase shadow-md"
                >
                  {formLoading ? 'Registrando...' : 'Confirmar Egreso'}
                </button>
            </div>

          </form>
        </Modal>
      )}
    </div>
  )
}
