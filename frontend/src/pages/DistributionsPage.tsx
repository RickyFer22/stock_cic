import { useEffect, useMemo, useState } from 'react'
import EmptyState from '../components/EmptyState'
import HowToCard from '../components/HowToCard'
import Modal from '../components/Modal'
import { apiDownload, apiGet, apiPost } from '../api/client'

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

  async function loadDistributions() {
    setLoading(true)
    try {
      const data = await apiGet<{ data: any[] }>('/api/movements?kind=OUTBOUND&limit=100')
      setRows(data.data)
    } catch (e: any) {
      setError(e.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDistributions()
  }, [])

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
    } catch (e: any) {
      alert('Error exportando Excel: ' + (e.message || 'Error desconocido'))
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
      await apiPost('/api/stock/outbound', {
        counterparty: destination,
        movement_type: movementType,
        notes: observaciones || undefined,
        items: selectedItems.map(it => ({ item_id: it.item_id, quantity: it.quantity }))
      })
      setShowForm(false)
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
            <h1 className="font-display font-black text-brand-green-900 text-3xl uppercase tracking-wider">Egresos</h1>
            <p className="text-slate-600 mt-1 font-medium text-sm">Registro de mercadería entregada, descartada o transferida.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            {/* Acción principal destacada */}
            <button
              onClick={() => setShowForm(true)}
              className="px-5 py-2.5 rounded-xl bg-brand-gold-500 text-brand-green-900 font-bold tracking-wide uppercase text-sm hover:brightness-110 shadow-md hover:shadow-lg transition-all order-first sm:order-none"
            >
              + Registrar egreso
            </button>
            <div className="w-px h-8 bg-slate-200 hidden sm:block" aria-hidden />
            {/* Resumen y exportación */}
            <div className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold uppercase tracking-wider">
              Total: <span className="text-brand-green-900 text-base">{filteredRows.length}</span>
            </div>
            <button
              onClick={handleExportExcel}
              disabled={exporting || !rows.length}
              className="px-5 py-2.5 rounded-xl bg-white border-2 border-slate-200 shadow-sm text-xs sm:text-sm text-slate-700 font-bold uppercase tracking-wider hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-60"
            >
              {exporting ? 'Exportando…' : 'Exportar Excel'}
            </button>
          </div>
        </div>
      </div>
    )
  }, [filteredRows.length, exporting])

  if (loading) return <EmptyState icon="⏳" message="Cargando" sub="Buscando registros..." />
  if (error) return <EmptyState icon="⚠️" message="Error" sub={error} />

  return (
    <div className="space-y-5">
      {header}
      <HowToCard
        title="Guia rapida de egresos"
        steps={[
          'Paso 1: toca "+ Registrar egreso".',
          'Paso 2: completa tipo, destino y articulos.',
          'Paso 3: confirma y revisa el detalle tocando una fila.',
        ]}
      />

      <div className="bg-white/80 backdrop-blur-md border border-white/60 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por destino, operador u observación..."
          className="w-full md:max-w-xl rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-brand-green-700"
        />
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as 'all' | 'delivery' | 'transfer_out' | 'waste' | 'adjustment')}
          className="w-full md:w-64 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-brand-green-700"
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
      <div className="bg-white/80 backdrop-blur-md border border-white/60 rounded-[2rem] shadow-card overflow-hidden">
        <div className="overflow-auto scrollbar-hide">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100/50">
              <tr className="text-left text-slate-500 uppercase tracking-wider text-xs">
                <th className="px-5 py-4 font-bold">Fecha</th>
                <th className="px-5 py-4 font-bold">Tipo</th>
                <th className="px-5 py-4 font-bold">Destino / Observación</th>
                <th className="px-5 py-4 font-bold">Operador</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors" onClick={() => setSelectedId(r.id)}>
                  <td className="px-5 py-4 whitespace-nowrap text-slate-600 font-medium">{new Date(r.fecha).toLocaleString()}</td>
                  <td className="px-5 py-4 text-slate-700 font-bold">
                     {r.movement_type === 'delivery' ? 'Entrega' : r.movement_type === 'transfer_out' ? 'Transferencia' : r.movement_type === 'waste' ? 'Descarte' : 'Ajuste'}
                  </td>
                  <td className="px-5 py-4 text-slate-700 font-semibold">{r.counterparty} <span className="text-slate-400 font-normal ml-2">{r.notes}</span></td>
                  <td className="px-5 py-4 text-slate-500 font-medium">{r.operador}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap gap-3 justify-between">
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wide">Tipo de Egreso</div>
                    <div className="text-slate-900 font-semibold text-lg">
                      {detail.movement_type === 'delivery' ? 'Entrega (Asistencia)' : detail.movement_type === 'transfer_out' ? 'Transferencia / Pase' : detail.movement_type === 'waste' ? 'Descarte (Vencido/Roto)' : 'Ajuste de Stock'}
                    </div>
                    <div className="text-sm text-slate-600">Destino: <b>{detail.counterparty}</b></div>
                    {detail.notes && <div className="text-sm text-slate-600">Notas: <b>{detail.notes}</b></div>}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500 uppercase tracking-wide">Fecha</div>
                    <div className="text-slate-900 font-semibold">{new Date(detail.fecha).toLocaleString()}</div>
                    <div className="text-sm text-slate-600">Operador: <b>{detail.operador}</b></div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-slate-600">
                  Artículos: <b className="text-slate-900">{detail.items.length}</b>
                </div>
                <button
                  onClick={async () => {
                    const mod = await import('../lib/pdf')
                    // Assuming generateDistributionPDF can handle the new detail structure or a new function is needed
                    // For now, keeping the old function call, but it might need adaptation.
                    mod.generateDistributionPDF(detail)
                  }}
                  className="px-5 py-2.5 rounded-xl bg-brand-green-900 text-white font-bold tracking-wide hover:bg-brand-green-700 hover:shadow-md transition-all uppercase text-sm"
                >
                  Exportar PDF
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead className="bg-white">
                    <tr className="text-left text-slate-600">
                      <th className="px-3 py-2 font-semibold">Código</th>
                      <th className="px-3 py-2 font-semibold">Artículo</th>
                      <th className="px-3 py-2 font-semibold">Unidad</th>
                      <th className="px-3 py-2 font-semibold text-right">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((it) => (
                      <tr key={`${it.code}-${it.name}`} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-semibold text-brand-blue-700">{it.code}</td>
                        <td className="px-3 py-2 text-slate-900">{it.name}</td>
                        <td className="px-3 py-2 text-slate-700">{it.unit}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900">{it.quantity}</td>
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
            
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">1. Detalles del Egreso</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <label className="block">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tipo de Egreso</span>
                    <select
                      value={movementType}
                      onChange={e => setMovementType(e.target.value)}
                      className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-brand-green-500 focus:border-brand-green-500 outline-none"
                    >
                      <option value="delivery">Entrega (Asistencia)</option>
                      <option value="transfer_out">Transferencia / Pase</option>
                      <option value="waste">Descarte (Vencido/Roto)</option>
                      <option value="adjustment">Ajuste de Stock</option>
                    </select>
                 </label>
                 <label className="block">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Destino / Entidad</span>
                    <input
                      required
                      value={destination}
                      onChange={e => setDestination(e.target.value)}
                      placeholder="Ej. Comedor, Persona, Área..."
                      className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-brand-green-500 focus:border-brand-green-500 outline-none"
                    />
                 </label>
              </div>
            </div>

            {/* Items Selection */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3">2. Artículos a entregar</h3>
              <div className="flex gap-2 mb-4">
                 <select
                   value={pendingItemId}
                   onChange={(event) => setPendingItemId(event.target.value)}
                   className="flex-1 rounded-xl border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-brand-green-500 focus:border-brand-green-500 outline-none"
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
                  className="px-4 py-2 bg-slate-800 text-white rounded-xl font-bold uppercase tracking-wide text-xs hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   Añadir
                 </button>
              </div>

              {selectedItems.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100/50">
                      <tr>
                        <th className="px-3 py-2 font-bold text-slate-600">Artículo</th>
                        <th className="px-3 py-2 font-bold text-slate-600 w-24">Cantidad</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.map((sit, idx) => (
                        <tr key={sit.item_id} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-semibold text-slate-800">{sit.name}</td>
                          <td className="px-3 py-2">
                            <input 
                              type="number" min="1" required
                              value={sit.quantity}
                              onChange={e => {
                                const newItems = [...selectedItems]
                                newItems[idx].quantity = parseInt(e.target.value) || 1
                                setSelectedItems(newItems)
                              }}
                              className="w-full border border-slate-300 rounded px-2 py-1 outline-none text-center"
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
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Observaciones (Opcional)</span>
              <input
                value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-brand-green-500 focus:border-brand-green-500 outline-none"
                placeholder="Motivo de la entrega o nota adicional..."
              />
            </label>

            {formError && (
               <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                 {formError}
               </div>
            )}

            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100 transition tracking-wide"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 rounded-xl bg-brand-green-900 text-white font-bold tracking-widest disabled:opacity-50 hover:bg-brand-green-700 transition uppercase shadow-md"
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
