import { useEffect, useMemo, useState } from 'react'
import EmptyState from '../components/EmptyState'
import HowToCard from '../components/HowToCard'
import Modal from '../components/Modal'
import Banner, { type Feedback } from '../components/Banner'
import ConfirmDialog from '../components/ConfirmDialog'
import { apiDownload, apiGet, apiUploadExcel, apiPost, apiDelete } from '../api/client'
import { formatNumero } from '../lib/format'

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
  stock_maximo?: number | null
  is_active: boolean
}

type EstadoStock = 'sin' | 'bajo' | 'sobre' | 'vence' | 'normal'

/**
 * Clasificación de un artículo según su stock.
 *
 * Replica exactamente las reglas del endpoint /api/statistics/health, así que
 * los números de las tarjetas y las filas que quedan al filtrar siempre
 * coinciden. Si allá cambia el criterio, tiene que cambiar acá también:
 *   sin   → stock_actual = 0
 *   bajo  → stock_actual <= stock_minimo y > 0   (el <= es del backend, no un error)
 *   sobre → stock_maximo definido y stock_actual > stock_maximo
 *   vence → vencimiento dentro de los próximos 30 días
 *
 * Se calcula en el cliente porque /api/items devuelve el catálogo completo sin
 * paginar, así que el listado que tenemos es el universo entero.
 */
function estadoDeStock(it: ItemRow): EstadoStock {
  if (it.stock_actual === 0) return 'sin'
  if (it.stock_minimo > 0 && it.stock_actual <= it.stock_minimo) return 'bajo'
  if (it.stock_maximo != null && it.stock_actual > it.stock_maximo) return 'sobre'
  return 'normal'
}

function venceProximo(it: ItemRow): boolean {
  if (!it.expiry_date) return false
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const limite = new Date(hoy); limite.setDate(limite.getDate() + 30)
  const v = new Date(it.expiry_date)
  return v >= hoy && v <= limite
}

/** Cómo se pinta cada estado en la celda de stock. 'normal' no se pinta: si todo
 *  llevara color, el color dejaría de señalar nada. */
const PINTA_ESTADO: Record<Exclude<EstadoStock, 'normal'>, { clase: string; etiqueta: string }> = {
  sin:   { clase: 'text-state-danger', etiqueta: 'Sin stock' },
  bajo:  { clase: 'text-state-warn',   etiqueta: 'Bajo el mínimo' },
  sobre: { clase: 'text-state-ok',     etiqueta: 'Sobre el máximo' },
  vence: { clase: 'text-state-info',   etiqueta: 'Vence pronto' },
}

type InventoryHealthSummary = {
  total: number
  lowStock: number
  outOfStock: number
  overStock: number
  expiringSoon: number
}

export default function ItemsPage({ role }: { role: string | null }) {
  const isAdminOrSupervisor = role === 'admin' || role === 'supervisor'

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
  // Las tarjetas de estado dejan de ser solo un numero: filtran la tabla.
  // 'normal' no es filtrable: nadie pide "mostrame lo que esta bien".
  const [filtroEstado, setFiltroEstado] = useState<Exclude<EstadoStock, 'normal'> | 'todos'>('todos')

  // Proveedores ya usados, para sugerirlos en el ingreso y evitar que el mismo
  // organismo se escriba distinto en cada carga.
  const [proveedores, setProveedores] = useState<string[]>([])

  // Avisos en linea y confirmación propia, en reemplazo de alert()/confirm().
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [itemAEliminar, setItemAEliminar] = useState<ItemRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState<'items' | 'health' | null>(null)

  // Artículo elegido en el ingreso, para mostrar el stock resultante antes de guardar.
  const ingresoItem = useMemo(
    () => items.find(it => it.id === ingresoData.item_id) || null,
    [items, ingresoData.item_id]
  )

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

  async function loadProveedores() {
    try {
      const res = await apiGet<{ data: { counterparty: string | null }[] }>('/api/movements?kind=INGRESO&limit=200')
      const nombres = Array.from(
        new Set(res.data.map(m => (m.counterparty || '').trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, 'es'))
      setProveedores(nombres)
    } catch {
      // Sugerencias opcionales: si fallan, el campo sigue siendo de texto libre.
    }
  }

  useEffect(() => {
    loadItems()
    loadProveedores()
    setHealthLoading(true)
    apiGet<{ data: InventoryHealthSummary }>('/api/statistics/health')
      .then(res => setHealth(res.data))
      .catch(() => {})
      .finally(() => setHealthLoading(false))
  }, [])

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const porEstado = items.filter((item) => {
      if (filtroEstado === 'todos') return true
      if (filtroEstado === 'vence') return venceProximo(item)
      return estadoDeStock(item) === filtroEstado
    })
    if (!needle) return porEstado
    return porEstado.filter((item) =>
      [
        item.code,
        item.name,
        item.category ?? '',
        item.location ?? '',
        item.unit,
      ].some((value) => String(value).toLowerCase().includes(needle))
    )
  }, [items, search, filtroEstado])

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

  async function handleDeleteItem() {
    if (!itemAEliminar) return
    setDeleting(true)
    try {
      await apiDelete(`/api/items/${itemAEliminar.id}`)
      loadItems()
      setFeedback({ tone: 'success', text: `Artículo ${itemAEliminar.code} — ${itemAEliminar.name} eliminado correctamente.` })
      setItemAEliminar(null)
    } catch (err: any) {
      setFeedback({ tone: 'error', text: err.message || 'Error al eliminar el artículo.' })
      setItemAEliminar(null)
    } finally {
      setDeleting(false)
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
      loadProveedores()
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

  // El estado de descarga vive en React: antes se deshabilitaba el boton con
  // document.getElementById, que se pierde en cada re-render.
  async function handleExport() {
    setExporting('items')
    try {
      await apiDownload('/api/export/items.xlsx', 'items_san_roque.xlsx')
      setFeedback({ tone: 'success', text: 'Listado de artículos descargado.' })
    } catch (err: any) {
      setFeedback({ tone: 'error', text: `No se pudo exportar el listado: ${err.message}` })
    } finally {
      setExporting(null)
    }
  }

  async function handleExportHealth() {
    setExporting('health')
    try {
      await apiDownload('/api/export/inventory-health.xlsx', 'estado_stock_san_roque.xlsx')
      setFeedback({ tone: 'success', text: 'Reporte de estado de stock descargado.' })
    } catch (err: any) {
      setFeedback({ tone: 'error', text: `No se pudo exportar el reporte: ${err.message}` })
    } finally {
      setExporting(null)
    }
  }

  const header = useMemo(() => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-extrabold text-ink text-3xl uppercase tracking-wider">Artículos</h1>
          <p className="text-ink-2 mt-1 font-medium text-sm">Catálogo de artículos y stock actual.</p>
        </div>
      </div>
      {/* Acciones principales: orden claro (alta prioridad primero) */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-ink-3 uppercase tracking-wider mr-1 hidden sm:inline">Acciones</span>
        <button
          onClick={() => setShowForm(true)}
          className="px-5 py-2.5 rounded-xl bg-accent-strong text-accent-ink font-bold tracking-wide uppercase text-sm hover:brightness-110 shadow-md hover:shadow-lg transition-all"
        >
          + Nuevo ítem
        </button>
        <button
          onClick={() => setShowIngreso(true)}
          className="px-5 py-2.5 rounded-xl bg-state-ok-bg text-state-ok font-bold tracking-wide uppercase text-sm hover:brightness-110 shadow-md hover:shadow-lg transition-all"
        >
          + Ingresar stock
        </button>
        <button
          onClick={() => setShowEgreso(true)}
          className="px-5 py-2.5 rounded-xl bg-state-danger-bg text-state-danger font-bold tracking-wide uppercase text-sm hover:brightness-110 shadow-md hover:shadow-lg transition-all"
        >
          − Egresar stock
        </button>
        <div className="w-px h-8 bg-rule hidden sm:block" aria-hidden />
        <span className="text-xs font-bold text-ink-3 uppercase tracking-wider mr-1 hidden sm:inline">Reportes y datos</span>
        <button
          onClick={handleExportHealth}
          disabled={exporting !== null}
          className="px-5 py-2.5 rounded-xl bg-paper border-2 border-rule shadow-sm font-bold tracking-wide text-ink-2 hover:bg-paper-3 hover:border-rule-strong transition-all uppercase text-sm disabled:opacity-50"
        >
          {exporting === 'health' ? 'Generando…' : 'Reporte stock'}
        </button>
        <button
          onClick={handleExport}
          disabled={exporting !== null}
          className="px-5 py-2.5 rounded-xl bg-paper border-2 border-rule shadow-sm font-bold tracking-wide text-ink-2 hover:bg-paper-3 hover:border-rule-strong transition-all uppercase text-sm disabled:opacity-50"
        >
          {exporting === 'items' ? 'Generando…' : 'Exportar Excel'}
        </button>
        <label className="px-5 py-2.5 rounded-xl bg-accent-strong text-accent-ink font-bold tracking-wide uppercase text-sm hover:brightness-110 transition-all shadow-md hover:shadow-lg cursor-pointer">
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
      <Banner feedback={feedback} onDismiss={() => setFeedback(null)} />
      {itemAEliminar && (
        <ConfirmDialog
          title="Eliminar artículo"
          message={`¿Seguro que querés eliminar "${itemAEliminar.code} — ${itemAEliminar.name}"? Si ya tiene movimientos de stock, el sistema no va a permitirlo.`}
          confirmLabel="Eliminar"
          loading={deleting}
          onConfirm={handleDeleteItem}
          onCancel={() => setItemAEliminar(null)}
        />
      )}
      <HowToCard
        title="Guía rápida de artículos"
        steps={[
          'Paso 1: crea artículos con código único.',
          'Paso 2: usa Ingresar o Egresar stock para actualizar cantidades.',
          'Paso 3: exporta reportes para control y auditoría.',
        ]}
      />

      <div className="bg-paper-2 border border-rule rounded-[--radius-card] p-4 shadow-sm flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por código, artículo, categoría o ubicación..."
          className="w-full md:max-w-xl rounded-xl border border-rule bg-paper px-4 py-2.5 text-sm outline-none focus:border-focus"
        />
        <div className="px-4 py-2.5 rounded-xl bg-paper-3 text-ink-2 text-sm font-bold uppercase tracking-wider">
          Mostrando: <span className="text-accent text-base">{filteredItems.length}</span>
        </div>
      </div>

      {/* Estado del inventario. Antes eran cinco números que no se podían usar:
          decían "3 bajo stock" y había que salir a buscar cuáles a ojo en la
          tabla. Ahora cada uno filtra el listado, y se vuelve a tocar para
          quitar el filtro. Los conteos salen de la misma regla que pinta las
          filas, así que el número y las filas nunca se contradicen. */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3" role="group" aria-label="Filtrar por estado de stock">
        {([
          { k: 'todos', l: 'Ítems activos',        n: items.length,                                         clase: 'text-ink' },
          { k: 'bajo',  l: 'Bajo el mínimo',       n: items.filter(i => estadoDeStock(i) === 'bajo').length,  clase: 'text-state-warn' },
          { k: 'sin',   l: 'Sin stock',            n: items.filter(i => estadoDeStock(i) === 'sin').length,   clase: 'text-state-danger' },
          { k: 'sobre', l: 'Sobre el máximo',      n: items.filter(i => estadoDeStock(i) === 'sobre').length, clase: 'text-state-ok' },
          { k: 'vence', l: 'Vencen en 30 días',    n: items.filter(venceProximo).length,                      clase: 'text-state-info' },
        ] as const).map(({ k, l, n, clase }) => {
          const activo = filtroEstado === k
          return (
            <button
              key={k}
              type="button"
              onClick={() => setFiltroEstado(activo ? 'todos' : k)}
              aria-pressed={activo}
              data-tip={k === 'todos' ? 'Quitar el filtro y ver todo el catálogo' : `Ver solo los artículos en estado "${l}"`}
              className={`text-left rounded-[--radius-card] p-3 border transition-colors duration-[--dur-fast]
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus
                ${activo
                  ? 'bg-accent-soft border-accent'
                  : 'bg-paper-2 border-rule hover:border-rule-strong'}`}
            >
              <div className="text-[length:--text-xs] uppercase tracking-widest font-bold text-ink-3">{l}</div>
              <div className={`text-2xl font-black mt-1 tabular-nums ${n > 0 ? clase : 'text-ink-3'}`}>{n}</div>
            </button>
          )
        })}
      </div>

      {filtroEstado !== 'todos' && (
        <div className="flex items-center gap-3 text-[length:--text-sm]">
          <span className="text-ink-2">
            Mostrando solo <b className="text-ink">{PINTA_ESTADO[filtroEstado].etiqueta.toLowerCase()}</b>
            {' '}· {filteredItems.length} de {items.length} artículos
          </span>
          <button
            type="button"
            onClick={() => setFiltroEstado('todos')}
            className="font-bold uppercase tracking-wide text-[length:--text-xs] text-accent hover:underline"
          >
            Ver todos
          </button>
        </div>
      )}

      {importResult && (
        <div className="bg-paper-2 border border-accent/25 rounded-[--radius-card] p-6 shadow-sm">
          <h2 className="text-xl font-bold font-display text-accent mb-2 tracking-wide uppercase">Resultado Importación</h2>
          <div className="flex gap-8 text-sm font-medium">
             <div className="flex flex-col"><span className="text-ink-3 uppercase text-xs">Añadidos</span><span className="text-2xl font-black text-accent">{importResult.added}</span></div>
             <div className="flex flex-col"><span className="text-ink-3 uppercase text-xs">Actualizados</span><span className="text-2xl font-black text-state-warn">{importResult.updated}</span></div>
             <div className="flex flex-col"><span className="text-ink-3 uppercase text-xs">Ignorados</span><span className="text-2xl font-black text-ink-3">{importResult.ignored}</span></div>
          </div>
          <button onClick={() => setImportResult(null)} className="mt-4 px-4 py-2 font-bold text-ink-3 border border-rule rounded-xl hover:bg-paper-3 shadow-sm text-sm uppercase tracking-wide transition-all">
            Cerrar detalle
          </button>
        </div>
      )}

      {!items.length ? (
        <EmptyState message="Sin artículos" sub="No hay artículos cargados aún." />
      ) : !filteredItems.length ? (
        <EmptyState message="Sin resultados" sub="No hay artículos que coincidan con la búsqueda." />
      ) : (
        <div className="bg-paper-2 border border-rule rounded-[--radius-card] shadow-[--shadow-card] overflow-hidden">
          <div className="overflow-auto scrollbar-hide">
            <table className="min-w-full text-sm">
            <thead className="bg-paper-3">
              <tr className="text-left text-ink-3 uppercase tracking-wider text-xs">
                <th className="px-5 py-4 font-bold">Código</th>
                <th className="px-5 py-4 font-bold">Artículo</th>
                <th className="px-5 py-4 font-bold">Categoría</th>
                <th className="px-5 py-4 font-bold">Unidad</th>
                <th className="px-5 py-4 font-bold">Ubicación</th>
                <th className="px-5 py-4 font-bold">Vence</th>
                <th className="px-5 py-4 font-bold text-right">Stock</th>
                <th className="px-5 py-4 font-bold text-right">Mínimo</th>
                <th className="px-5 py-4 font-bold">Estado</th>
                {isAdminOrSupervisor && <th className="px-5 py-4 font-bold text-right">Opciones</th>}
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((it) => {
                const estado = estadoDeStock(it)
                const vence = venceProximo(it)
                // El estado de stock manda sobre el vencimiento: un artículo en
                // cero ya frena una entrega hoy, que venza pronto es posterior.
                const marca = estado !== 'normal' ? PINTA_ESTADO[estado] : vence ? PINTA_ESTADO.vence : null
                return (
                <tr key={it.id} className="border-t border-rule hover:bg-paper-3 transition-colors">
                  <td className="px-5 py-4 font-bold text-accent">{it.code}</td>
                  <td className="px-5 py-4 font-semibold text-ink">{it.name}</td>
                  <td className="px-5 py-4 text-ink-2">{it.category || '-'}</td>
                  <td className="px-5 py-4 text-ink-2 font-medium">{it.unit}</td>
                  <td className="px-5 py-4 text-ink-2">{it.location || '-'}</td>
                  <td className={`px-5 py-4 ${vence ? 'text-state-info font-semibold' : 'text-ink-2'}`}>
                    {it.expiry_date ? new Date(it.expiry_date).toLocaleDateString('es-AR') : '-'}
                  </td>
                  <td className={`px-5 py-4 text-right font-black text-base tabular-nums ${marca ? marca.clase : 'text-ink'}`}>
                    {formatNumero(it.stock_actual)}
                  </td>
                  <td className="px-5 py-4 text-right text-ink-3 font-semibold tabular-nums">{formatNumero(it.stock_minimo)}</td>
                  <td className="px-5 py-4">
                    {/* El color solo no alcanza: quien no distingue rojo de ámbar
                        necesita leer el estado, y con la tabla en blanco y negro
                        tampoco se ve. Por eso va el texto además del color. */}
                    {marca ? (
                      <span className={`inline-flex items-center gap-1.5 font-bold text-[length:--text-xs] uppercase tracking-wide ${marca.clase}`}>
                        <span aria-hidden="true">●</span>{marca.etiqueta}
                      </span>
                    ) : (
                      <span className="text-ink-3 text-[length:--text-xs]">—</span>
                    )}
                  </td>
                  {isAdminOrSupervisor && (
                    <td className="px-5 py-4 text-right">
                      {it.stock_actual === 0 && (
                        <button
                          onClick={() => setItemAEliminar(it)}
                          className="p-1.5 text-state-danger hover:bg-state-danger-bg rounded-lg transition-colors"
                          title={`Eliminar ${it.code} — ${it.name}`}
                          aria-label={`Eliminar artículo ${it.code} ${it.name}`}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                    </td>
                  )}
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {showForm && (
        <Modal title="Nuevo Ítem" onClose={() => setShowForm(false)} size="md">
          <form onSubmit={handleSubmit} className="space-y-4">
             <label className="block">
                <span className="text-xs font-bold text-ink-3 uppercase tracking-wide">Código Único</span>
                <input
                  readOnly
                  value={nextCode}
                  className="mt-1 block w-full rounded-xl border border-rule bg-paper-2 px-4 py-2 text-ink-2 font-mono font-bold cursor-not-allowed outline-none"
                />
                <p className="text-[10px] text-ink-3 mt-1">Se genera automáticamente</p>
             </label>
             <label className="block">
                <span className="text-xs font-bold text-ink-3 uppercase tracking-wide">Nombre del Artículo</span>
                <input
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                  className="mt-1 block w-full rounded-xl border border-rule px-4 py-2 focus:ring-2 focus:outline-focus focus:border-focus outline-none"
                  placeholder="Ej: FIDEOS TALLARINES 500G"
                />
             </label>
             <div className="grid grid-cols-2 gap-4">
               <label className="block">
                  <span className="text-xs font-bold text-ink-3 uppercase tracking-wide">Unidad</span>
                  <input
                    required
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    className="mt-1 block w-full rounded-xl border border-rule px-4 py-2 focus:ring-2 focus:outline-focus focus:border-focus outline-none"
                  />
               </label>
               <label className="block">
                  <span className="text-xs font-bold text-ink-3 uppercase tracking-wide">Stock Mínimo</span>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.stock_minimo}
                    onChange={e => setFormData({ ...formData, stock_minimo: parseInt(e.target.value) || 0 })}
                    className="mt-1 block w-full rounded-xl border border-rule px-4 py-2 focus:ring-2 focus:outline-focus focus:border-focus outline-none"
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
                  className="px-4 py-2 rounded-xl text-ink-2 font-semibold hover:bg-paper-3 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 rounded-xl bg-accent-strong text-accent-ink font-bold disabled:opacity-50 hover:brightness-110 transition"
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
              <span className="text-xs font-bold text-ink-3 uppercase tracking-wide">Artículo</span>
              <select
                required
                value={ingresoData.item_id}
                onChange={e => setIngresoData({ ...ingresoData, item_id: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-rule px-4 py-2 focus:ring-2 focus:ring-focus focus:border-focus outline-none"
              >
                <option value="" disabled>Selecciónar un artículo</option>
                {items.map(it => (
                  <option key={it.id} value={it.id}>{it.code} - {it.name} (Disp: {it.stock_actual})</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-ink-3 uppercase tracking-wide">Cantidad que ingresa</span>
              <input
                type="number"
                min="1"
                required
                value={ingresoData.quantity}
                onChange={e => setIngresoData({ ...ingresoData, quantity: parseInt(e.target.value) || 1 })}
                className="mt-1 block w-full rounded-xl border border-rule px-4 py-2 focus:ring-2 focus:ring-focus focus:border-focus outline-none"
              />
              {ingresoItem && ingresoData.quantity > 0 && (
                <span className="mt-1.5 block text-xs font-semibold text-ink-3">
                  Stock resultante:{' '}
                  <b className="text-ink-2">{ingresoItem.stock_actual}</b>
                  {' → '}
                  <b className="text-state-ok">{ingresoItem.stock_actual + ingresoData.quantity}</b>
                </span>
              )}
            </label>
            <label className="block">
              <span className="text-xs font-bold text-ink-3 uppercase tracking-wide">Tipo de ingreso</span>
              <select
                required
                value={ingresoData.movement_type}
                onChange={e => setIngresoData({ ...ingresoData, movement_type: e.target.value as any })}
                className="mt-1 block w-full rounded-xl border border-rule px-4 py-2 focus:ring-2 focus:ring-focus focus:border-focus outline-none"
              >
                <option value="donation">Donación</option>
                <option value="purchase">Compra</option>
                <option value="transfer_in">Transferencia recibida</option>
                <option value="adjustment">Ajuste</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-ink-3 uppercase tracking-wide">Proveedor / Origen</span>
              <input
                required
                list="proveedores-sugeridos"
                value={ingresoData.provider}
                onChange={e => setIngresoData({ ...ingresoData, provider: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-rule px-4 py-2 focus:ring-2 focus:ring-focus focus:border-focus outline-none"
                placeholder="Ej: Ministerio de Desarrollo Social"
              />
              <datalist id="proveedores-sugeridos">
                {proveedores.map(p => <option key={p} value={p} />)}
              </datalist>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-ink-3 uppercase tracking-wide">Remito / Observaciónes</span>
              <input
                value={ingresoData.notes}
                onChange={e => setIngresoData({ ...ingresoData, notes: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-rule px-4 py-2 focus:ring-2 focus:ring-focus focus:border-focus outline-none"
                placeholder="Opcional: número de remito, detalle de la entrega"
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
                className="px-4 py-2 rounded-xl text-ink-2 font-semibold hover:bg-paper-3 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={ingresoLoading}
                className="px-5 py-2 rounded-xl bg-state-ok text-accent-ink font-bold disabled:opacity-50 hover:bg-state-ok transition"
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
              <span className="text-xs font-bold text-ink-3 uppercase tracking-wide">Artículo</span>
              <select
                required
                value={egresoData.item_id}
                onChange={e => setEgresoData({ ...egresoData, item_id: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-rule px-4 py-2 focus:ring-2 focus:ring-focus focus:border-focus outline-none"
              >
                <option value="" disabled>Selecciónar un artículo</option>
                {items.map(it => (
                  <option key={it.id} value={it.id}>{it.code} - {it.name} (Disp: {it.stock_actual})</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-ink-3 uppercase tracking-wide">Cantidad a egresar</span>
              <input
                type="number"
                min="1"
                required
                value={egresoData.quantity}
                onChange={e => setEgresoData({ ...egresoData, quantity: parseInt(e.target.value) || 1 })}
                className="mt-1 block w-full rounded-xl border border-rule px-4 py-2 focus:ring-2 focus:ring-focus focus:border-focus outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-ink-3 uppercase tracking-wide">Tipo de egreso</span>
              <select
                required
                value={egresoData.movement_type}
                onChange={e => setEgresoData({ ...egresoData, movement_type: e.target.value as any })}
                className="mt-1 block w-full rounded-xl border border-rule px-4 py-2 focus:ring-2 focus:ring-focus focus:border-focus outline-none"
              >
                <option value="delivery">Entrega / Distribución</option>
                <option value="transfer_out">Transferencia</option>
                <option value="waste">Descarte / Pérdida</option>
                <option value="adjustment">Ajuste</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-ink-3 uppercase tracking-wide">Destinatario / Destino</span>
              <input
                required
                value={egresoData.destination}
                onChange={e => setEgresoData({ ...egresoData, destination: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-rule px-4 py-2 focus:ring-2 focus:ring-focus focus:border-focus outline-none"
                placeholder="Ej: Beneficiario, Área, etc."
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-ink-3 uppercase tracking-wide">Observaciónes</span>
              <input
                value={egresoData.notes}
                onChange={e => setEgresoData({ ...egresoData, notes: e.target.value })}
                className="mt-1 block w-full rounded-xl border border-rule px-4 py-2 focus:ring-2 focus:ring-focus focus:border-focus outline-none"
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
                className="px-4 py-2 rounded-xl text-ink-2 font-semibold hover:bg-paper-3 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={egresoLoading}
                className="px-5 py-2 rounded-xl bg-state-danger text-accent-ink font-bold disabled:opacity-50 hover:bg-state-danger transition"
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
