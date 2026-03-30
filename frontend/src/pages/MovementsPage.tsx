import { useEffect, useMemo, useState } from 'react'
import EmptyState from '../components/EmptyState'
import { apiGet } from '../api/client'

type MovementRow = {
  id: string
  fecha: string
  kind: string
  quantity: number
  notes: string | null
  code: string
  item_name: string
  operador: string
}

export default function MovementsPage() {
  const [rows, setRows] = useState<MovementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<'all' | 'INGRESO' | 'DISTRIBUTION' | 'ADJUSTMENT'>('all')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    apiGet<{ data: MovementRow[] }>('/api/movements')
      .then((data) => { if (!cancelled) setRows(data.data) })
      .catch((e) => { if (!cancelled) setError(e.message || 'Error') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter((row) => {
      const matchesKind = kindFilter === 'all' || row.kind === kindFilter
      if (!matchesKind) return false
      if (!needle) return true
      return [
        row.code,
        row.item_name,
        row.operador,
        row.notes ?? '',
      ].some((value) => String(value).toLowerCase().includes(needle))
    })
  }, [rows, search, kindFilter])

  const header = useMemo(() => (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div>
        <h1 className="font-display font-black text-brand-green-900 text-3xl uppercase tracking-wider">Movimientos</h1>
        <p className="text-slate-600 mt-1 font-medium text-sm">Seguimiento de ingresos, egresos y ajustes de stock.</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="px-4 py-2.5 rounded-xl bg-white border-2 border-slate-200 shadow-sm text-sm text-slate-600 font-bold uppercase tracking-wider">
          Total: <b className="text-brand-green-900 text-base">{filteredRows.length}</b>
        </div>
      </div>
    </div>
  ), [filteredRows.length])

  if (loading) return <EmptyState icon="⏳" message="Cargando" sub="Buscando movimientos..." />
  if (error) return <EmptyState icon="⚠️" message="Error" sub={error} />

  return (
    <div className="space-y-5">
      {header}
      
      <div className="bg-white/80 backdrop-blur-md border border-white/60 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por código, artículo, operador o nota..."
          className="w-full md:max-w-xl rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-brand-green-700"
        />
        <select
          value={kindFilter}
          onChange={(event) => setKindFilter(event.target.value as 'all' | 'INGRESO' | 'DISTRIBUTION' | 'ADJUSTMENT')}
          className="w-full md:w-60 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-brand-green-700"
        >
          <option value="all">Todos los tipos</option>
          <option value="INGRESO">Ingresos</option>
          <option value="DISTRIBUTION">Egresos</option>
          <option value="ADJUSTMENT">Ajustes</option>
        </select>
      </div>

      {!rows.length ? (
        <EmptyState message="Sin movimientos" sub="No hay registros cargados aún." />
      ) : !filteredRows.length ? (
        <EmptyState message="Sin resultados" sub="Ajustá la búsqueda o los filtros para ver movimientos." />
      ) : (
      <div className="bg-white/80 backdrop-blur-md border border-white/60 rounded-[2rem] shadow-card overflow-hidden">
        <div className="overflow-auto scrollbar-hide">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100/50">
              <tr className="text-left text-slate-500 uppercase tracking-wider text-xs">
                <th className="px-5 py-4 font-bold">Fecha</th>
                <th className="px-5 py-4 font-bold">Tipo</th>
                <th className="px-5 py-4 font-bold">Artículo</th>
                <th className="px-5 py-4 font-bold text-right">Cantidad</th>
                <th className="px-5 py-4 font-bold">Operador</th>
                <th className="px-5 py-4 font-bold">Notas</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4 whitespace-nowrap text-slate-600 font-medium">{new Date(r.fecha).toLocaleString()}</td>
                  <td className="px-5 py-4 font-bold">
                    <span className={`px-2 py-1.5 rounded-lg text-[10px] uppercase font-black tracking-widest ${
                      r.kind === 'INGRESO' ? 'bg-emerald-100 text-emerald-800' :
                      r.kind === 'DISTRIBUTION' ? 'bg-rose-100 text-rose-800' :
                      r.kind === 'ADJUSTMENT' ? 'bg-amber-100 text-amber-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {r.kind === 'DISTRIBUTION' ? 'EGRESO' : r.kind}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-800">
                    <span className="text-brand-blue-700 mr-2">{r.code}</span>
                    {r.item_name}
                  </td>
                  <td className={`px-5 py-4 text-right font-black text-base ${r.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {r.quantity > 0 ? '+' : ''}{r.quantity}
                  </td>
                  <td className="px-5 py-4 text-slate-700 font-medium">{r.operador}</td>
                  <td className="px-5 py-4 text-slate-500 max-w-[200px] truncate" title={r.notes || ''}>{r.notes || '-'}</td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
