import { useEffect, useMemo, useState } from 'react'
import EmptyState from '../components/EmptyState'
import HowToCard from '../components/HowToCard'
import Modal from '../components/Modal'
import { apiDownload, apiGet, apiUploadExcel, apiPost } from '../api/client'

type ItemRow = {
  id: string
  code: string
  name: string
  category: string | null
  unit: string
  location?: string | null
  expiry_date?: string | null
  stock_actual: number
  stock_minimo: number
  is_active: boolean
}

type InventoryHealthSummary = {
  total: number
  lowStock: number
  outOfStock: number
  overStock: number
  expiringSoon: number
}

export default function ItemsPage() {
  const [items, setItems] = useState<ItemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<any>(null)
  const [importing, setImporting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    unit: 'unidad',
    location: '',
    expiry_date: '',
    stock_minimo: 0
  })

  // Auto-generate next sequential code
  const nextCode = useMemo(() => {
    const maxNum = items.reduce((max, it) => {
      const num = parseInt(it.code, 10)
      return !isNaN(num) && num > max ? num : max
    }, 0)
    return String(maxNum + 1).padStart(5, '0')
  }, [items])

  const [showIngreso, setShowIngreso] = useState(false)
  const [ingresoData, setIngresoData] = useState({
    item_id: '',
    quantity: 1,
    movement_type: 'donation' as 'donation' | 'purchase' | 'transfer_in' | 'adjustment',
    provider: '',
    notes: ''
  })
  const [ingresoLoading, setIngresoLoading] = useState(false)
  const [ingresoError, setIngresoError] = useState<string | null>(null)

  const [showEgreso, setShowEgreso] = useState(false)
  const [egresoData, setEgresoData] = useState({
    item_id: '',
    quantity: 1,
    movement_type: 'delivery' as 'delivery' | 'transfer_out' | 'waste' | 'adjustment',
    destination: '',
    notes: ''
  })
  const [egresoLoading, setEgresoLoading] = useState(false)
  const [egresoError, setEgresoError] = useState<string | null>(null)
  const [health, setHealth] = useState<InventoryHealthSummary | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [search, setSearch] = useState('')

  async function loadItems() {
    setLoading(true)
    try {
      const data = await apiGet<{ data: ItemRow[] }>('/api/items')
      setItems(data.data)
    } catch (e: any) {
      setError(e.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
    setHealthLoading(true)
    apiGet<{ data: InventoryHealthSummary }>('/api/statistics/health')
      .then(res => setHealth(res.data))
      .catch(() => {})
      .finally(() => setHealthLoading(false))
  }, [])

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return items
    return items.filter((item) =>
      [
        item.code,
        item.name,
        item.category ?? '',
        item.location ?? '',
        item.unit,
      ].some((value) => String(value).toLowerCase().includes(needle))
    )
  }, [items, search])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setFormLoading(true)
    try {
      const payload: Record<string, any> = {
        code: nextCode,
        name: formData.name,
        unit: formData.unit || 'unidad',
      }
      if (formData.location?.trim()) payload.location = formData.location.trim()
      if (formData.expiry_date) payload.expiry_date = formData.expiry_date
      const minimo = Number(formData.stock_minimo)
      if (!isNaN(minimo) && minimo > 0) payload.stock_minimo = minimo
      
      await apiPost('/api/items', payload)
      setShowForm(false)
      loadItems()
    } catch (err: any) {
      setFormError(err.message || 'Error creando ítem')
    } finally {
      setFormLoading(false)
    }
  }

  async function handleIngresoSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIngresoError(null)
    setIngresoLoading(true)
    try {
      await apiPost('/api/stock/ingreso', {
        item_id: ingresoData.item_id,
        quantity: Number(ingresoData.quantity),
        movement_type: ingresoData.movement_type,
        provider: ingresoData.provider || undefined,
        notes: ingresoData.notes || undefined
      })
      setShowIngreso(false)
      loadItems()
      setIngresoData({ item_id: '', quantity: 1, movement_type: 'donation', provider: '', notes: '' })
    } catch (err: any) {
      setIngresoError(err.message || 'Error registrando ingreso')
    } finally {
      setIngresoLoading(false)
    }
  }

  async function handleEgresoSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEgresoError(null)
    setEgresoLoading(true)
    try {
      await apiPost('/api/stock/outbound', {
        item_id: egresoData.item_id,
        quantity: Number(egresoData.quantity),
        movement_type: egresoData.movement_type,
        destination: egresoData.destination,
        notes: egresoData.notes || undefined
      })
      setShowEgreso(false)
      loadItems()
      setEgresoData({ item_id: '', quantity: 1, movement_type: 'delivery', destination: '', notes: '' })
    } catch (err: any) {
      setEgresoError(err.message || 'Error registrando egreso')
    } finally {
      setEgresoLoading(false)
    }
  }

  async function handleExport() {
    try {
      const btn = document.getElementById('btn-export') as HTMLButtonElement
      if (btn) btn.disabled = true
      await apiDownload('/api/export/items.xlsx', 'items_san_roque.xlsx')
      alert('La exportación de Excel ha comenzado. Revise sus descargas.')
    } catch (err: any) {
      alert('Error exportando: ' + err.message)
    } finally {
      const btn = document.getElementById('btn-export') as HTMLButtonElement
      if (btn) btn.disabled = false
    }
  }

  async function handleExportHealth() {
    try {
      await apiDownload('/api/export/inventory-health.xlsx', 'estado_stock_san_roque.xlsx')
      alert('Reporte de estado de stock generado. Revise sus descargas.')
    } catch (err: any) {
      alert('Error exportando reporte de stock: ' + err.message)
    }
  }

  const header = useMemo(() => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-black text-brand-green-900 text-3xl uppercase tracking-wider">Artículos</h1>
          <p className="text-slate-600 mt-1 font-medium text-sm">Catálogo de artículos y stock actual.</p>
        </div>
      </div>
      {/* Acciones principales: orden claro (alta prioridad primero) */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">Acciones</span>
        <button
          onClick={() => setShowForm(true)}
          className="px-5 py-2.5 rounded-xl bg-brand-gold-500 text-brand-green-900 font-bold tracking-wide uppercase text-sm hover:brightness-110 shadow-md hover:shadow-lg transition-all"
        >
          + Nuevo ítem
        </button>
        <button
          onClick={() => setShowIngreso(true)}
          className="px-5 py-2.5 rounded-xl bg-emerald-100 text-emerald-900 font-bold tracking-wide uppercase text-sm hover:brightness-110 shadow-md hover:shadow-lg transition-all"
        >
          + Ingresar stock
        </button>
        <button
          onClick={() => setShowEgreso(true)}
          className="px-5 py-2.5 rounded-xl bg-rose-100 text-rose-900 font-bold tracking-wide uppercase text-sm hover:brightness-110 shadow-md hover:shadow-lg transition-all"
        >
          − Egresar stock
        </button>
        <div className="w-px h-8 bg-slate-200 hidden sm:block" aria-hidden />
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">Reportes y datos</span>
        <button
          onClick={handleExportHealth}
          className="px-5 py-2.5 rounded-xl bg-white border-2 border-slate-200 shadow-sm font-bold tracking-wide text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all uppercase text-sm"
        >
          Reporte stock
        </button>
        <button
          id="btn-export"
          onClick={handleExport}
          className="px-5 py-2.5 rounded-xl bg-white border-2 border-slate-200 shadow-sm font-bold tracking-wide text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all uppercase text-sm disabled:opacity-50"
        >
          Exportar Excel
        </button>
        <label className="px-5 py-2.5 rounded-xl bg-brand-green-900 text-white font-bold tracking-wide uppercase text-sm hover:bg-brand-green-700 transition-all shadow-md hover:shadow-lg cursor-pointer">
          {importing ? 'Importando…' : 'Importar Excel'}
          <input
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              setImportResult(null)
              setImporting(true)
              try {
                const json = await apiUploadExcel('/api/import/items', f)
                setImportResult(json.data)
                const refreshed = await apiGet<{ data: ItemRow[] }>('/api/items')
                setItems(refreshed.data)
              } catch (err) {
                setError((err as Error).message)
              } finally {
                setImporting(false)
              }
            }}
          />
        </label>
      </div>
    </div>
  ), [importing])

  if (loading) return <EmptyState icon="⏳" message="Cargando" sub="Leyendo items..." />
  if (error) return <EmptyState icon="⚠️" message="Error" sub={error} />

  return (
    <div className="space-y-5">
      {header}
      <HowToCard
        title="Guia rapida de articulos"
        steps={[
          'Paso 1: crea articulos con codigo unico.',
          'Paso 2: usa Ingresar o Egresar stock para actualizar cantidades.',
          'Paso 3: exporta reportes para control y auditoria.',
        ]}
      />

      <div className="bg-white/80 backdrop-blur-md border border-white/60 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por código, artículo, categoría o ubicación..."
          className="w-full md:max-w-xl rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-brand-green-700"
        />
        <div className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold uppercase tracking-wider">
          Mostrando: <span className="text-brand-green-900 text-base">{filteredItems.length}</span>
        </div>
      </div>

      {/* KPIs de estado de stock */}
      {health && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-2xl p-3 bg-slate-900 text-white shadow-md">
            <div className="text-xs uppercase tracking-widest font-bold opacity-80">Ítems Activos</div>
            <div className="text-2xl font-black mt-1">{health.total}</div>
          </div>
          <div className="rounded-2xl p-3 bg-amber-50 border border-amber-100 text-amber-900 shadow-inner">
            <div className="text-xs uppercase tracking-widest font-bold">Bajo Stock</div>
            <div className="text-2xl font-black mt-1">{health.lowStock}</div>
          </div>
          <div className="rounded-2xl p-3 bg-rose-50 border border-rose-100 text-rose-900 shadow-inner">
            <div className="text-xs uppercase tracking-widest font-bold">Sin Stock</div>
            <div className="text-2xl font-black mt-1">{health.outOfStock}</div>
          </div>
          <div className="rounded-2xl p-3 bg-emerald-50 border border-emerald-100 text-emerald-900 shadow-inner">
            <div className="text-xs uppercase tracking-widest font-bold">Sobre Stock</div>
            <div className="text-2xl font-black mt-1">{health.overStock}</div>
          </div>
          <div className="rounded-2xl p-3 bg-indigo-50 border border-indigo-100 text-indigo-900 shadow-inner">
            <div className="text-xs uppercase tracking-widest font-bold">Por Vencer (30 días)</div>
            <div className="text-2xl font-black mt-1">{health.expiringSoon}</div>
          </div>
        </div>
      )}

      {importResult && (
        <div className="bg-white/80 backdrop-blur-md border border-brand-green-200 rounded-[2rem] p-6 shadow-sm">
          <h2 className="text-xl font-bold font-display text-brand-green-900 mb-2 tracking-wide uppercase">Resultado Importación</h2>
          <div className="flex gap-8 text-sm font-medium">
             <div className="flex flex-col"><span className="text-slate-500 uppercase text-xs">Añadidos</span><span className="text-2xl font-black text-brand-green-600">{importResult.added}</span></div>
             <div className="flex flex-col"><span className="text-slate-500 uppercase text-xs">Actualizados</span><span className="text-2xl font-black text-brand-gold-600">{importResult.updated}</span></div>
             <div className="flex flex-col"><span className="text-slate-500 uppercase text-xs">Ignorados</span><span className="text-2xl font-black text-slate-400">{importResult.ignored}</span></div>
          </div>
          <button onClick={() => setImportResult(null)} className="mt-4 px-4 py-2 font-bold text-slate-500 border border-slate-300 rounded-xl hover:bg-slate-50 shadow-sm text-sm uppercase tracking-wide transition-all">
            Cerrar detalle
          </button>
        </div>
      )}

      {!items.length ? (
        <EmptyState message="Sin artículos" sub="No hay artículos cargados aún." />
      ) : !filteredItems.length ? (
        <EmptyState message="Sin resultados" sub="No hay artículos que coincidan con la búsqueda." />
      ) : (
        <div className="bg-white/80 backdrop-blur-md border border-white/60 rounded-[2rem] shadow-card overflow-hidden">
          <div className="overflow-auto scrollbar-hide">
            <table className="min-w-full text-sm">
            <thead className="bg-slate-100/50">
              <tr className="text-left text-slate-500 uppercase tracking-wider text-xs">
                <th className="px-5 py-4 font-bold">Código</th>
                <th className="px-5 py-4 font-bold">Artículo</th>
                <th className="px-5 py-4 font-bold">Categoría</th>
                <th className="px-5 py-4 font-bold">Unidad</th>
                <th className="px-5 py-4 font-bold">Ubicacion</th>
                <th className="px-5 py-4 font-bold">Vence</th>
                <th className="px-5 py-4 font-bold text-right">Stock</th>
                <th className="px-5 py-4 font-bold text-right">Mínimo</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((it) => (
                <tr key={it.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4 font-bold text-brand-gold-500">{it.code}</td>
                  <td className="px-5 py-4 font-semibold text-slate-900">{it.name}</td>
                  <td className="px-5 py-4 text-slate-600">{it.category || '-'}</td>
                  <td className="px-5 py-4 text-slate-600 font-medium">{it.unit}</td>
                  <td className="px-5 py-4 text-slate-600">{it.location || '-'}</td>
                  <td className="px-5 py-4 text-slate-600">{it.expiry_date ? new Date(it.expiry_date).toLocaleDateString() : '-'}</td>
                  <td className="px-5 py-4 text-right font-black text-brand-green-900 text-base">{it.stock_actual}</td>
                  <td className="px-5 py-4 text-right text-slate-500 font-semibold">{it.stock_minimo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {showForm && (
        <Modal title="Nuevo Ítem" onClose={() => setShowForm(false)} size="md">
          <form onSubmit={handleSubmit} className="space-y-4">
             <label className="block">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Código Único</span>
                <input
                  readOnly
                  value={nextCode}
                  className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-slate-600 font-mono font-bold cursor-not-allowed outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">Se genera automáticamente</p>
             </label>
             <label className="block">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nombre del Artículo</span>
                <input
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-brand-green-500 focus:border-brand-green-500 outline-none"
                  placeholder="Ej: Fideos Tallarines 500g"
                />
             </label>
             <div className="grid grid-cols-2 gap-4">
               <label className="block">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Unidad</span>
                  <input
                    required
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-brand-green-500 focus:border-brand-green-500 outline-none"
                  />
               </label>
               <label className="block">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Stock Mínimo</span>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.stock_minimo}
                    onChange={e => setFormData({ ...formData, stock_minimo: parseInt(e.target.value) || 0 })}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-brand-green-500 focus:border-brand-green-500 outline-none"
                  />
               </label>
             </div>
             {formError && (
               <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                 {formError}
               </div>
             )}
             <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 rounded-xl bg-brand-green-900 text-white font-bold disabled:opacity-50 hover:bg-brand-green-700 transition"
                >
                  {formLoading ? 'Guardando...' : 'Crear Ítem'}
                </button>
             </div>
          </form>
        </Modal>
      )}

      {showIngreso && (
        <Modal title="Ingresar Stock" onClose={() => setShowIngreso(false)} size="md">
          <form onSubmit={handleIngresoSubmit} className="space-y-4">
            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Artículo</span>
              <select
                required
                value={ingresoData.item_id}
                onChange={e => setIngresoData({ ...ingresoData, item_id: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              >
                <option value="" disabled>Seleccionar un artículo</option>
                {items.map(it => (
                  <option key={it.id} value={it.id}>{it.code} - {it.name} (Disp: {it.stock_actual})</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Cantidad que ingresa</span>
              <input
                type="number"
                min="1"
                required
                value={ingresoData.quantity}
                onChange={e => setIngresoData({ ...ingresoData, quantity: parseInt(e.target.value) || 1 })}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Observaciones (Origen, Remito, etc.)</span>
              <input
                value={ingresoData.notes}
                onChange={e => setIngresoData({ ...ingresoData, notes: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </label>
            
            {ingresoError && (
               <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                 {ingresoError}
               </div>
            )}
            
            <div className="pt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowIngreso(false)}
                className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={ingresoLoading}
                className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-50 hover:bg-emerald-700 transition"
              >
                {ingresoLoading ? 'Guardando...' : 'Guardar Ingreso'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showEgreso && (
        <Modal title="Egresar Stock" onClose={() => setShowEgreso(false)} size="md">
          <form onSubmit={handleEgresoSubmit} className="space-y-4">
            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Artículo</span>
              <select
                required
                value={egresoData.item_id}
                onChange={e => setEgresoData({ ...egresoData, item_id: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
              >
                <option value="" disabled>Seleccionar un artículo</option>
                {items.map(it => (
                  <option key={it.id} value={it.id}>{it.code} - {it.name} (Disp: {it.stock_actual})</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Cantidad a egresar</span>
              <input
                type="number"
                min="1"
                required
                value={egresoData.quantity}
                onChange={e => setEgresoData({ ...egresoData, quantity: parseInt(e.target.value) || 1 })}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tipo de egreso</span>
              <select
                required
                value={egresoData.movement_type}
                onChange={e => setEgresoData({ ...egresoData, movement_type: e.target.value as any })}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
              >
                <option value="delivery">Entrega / Distribución</option>
                <option value="transfer_out">Transferencia</option>
                <option value="waste">Descarte / Pérdida</option>
                <option value="adjustment">Ajuste</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Destinatario / Destino</span>
              <input
                required
                value={egresoData.destination}
                onChange={e => setEgresoData({ ...egresoData, destination: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                placeholder="Ej: Beneficiario, Área, etc."
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Observaciones</span>
              <input
                value={egresoData.notes}
                onChange={e => setEgresoData({ ...egresoData, notes: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
              />
            </label>
            
            {egresoError && (
               <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                 {egresoError}
               </div>
            )}
            
            <div className="pt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowEgreso(false)}
                className="px-4 py-2 rounded-xl text-slate-600 font-semibold hover:bg-slate-100 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={egresoLoading}
                className="px-5 py-2 rounded-xl bg-rose-600 text-white font-bold disabled:opacity-50 hover:bg-rose-700 transition"
              >
                {egresoLoading ? 'Guardando...' : 'Guardar Egreso'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
