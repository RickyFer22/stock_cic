import { useEffect, useMemo, useState } from 'react'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import { apiDownload, apiGet, apiUploadExcel, apiPost } from '../api/client'

type BeneficiaryRow = {
  id: string
  dni: string
  apellido: string
  nombre: string
  barrio: string | null
  direccion: string | null
  telefono: string | null
}

export default function BeneficiariesPage() {
  const [rows, setRows] = useState<BeneficiaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<any>(null)
  const [importing, setImporting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [formData, setFormData] = useState({ 
    dni: '', apellido: '', nombre: '', barrio: '', direccion: '', telefono: ''
  })

  async function loadBeneficiaries() {
    setLoading(true)
    try {
      const data = await apiGet<{ data: BeneficiaryRow[] }>('/api/beneficiaries')
      setRows(data.data)
    } catch (e: any) {
      setError(e.message || 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBeneficiaries()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setFormLoading(true)
    try {
      await apiPost('/api/beneficiaries', formData)
      setShowForm(false)
      loadBeneficiaries()
    } catch (err: any) {
      setFormError(err.message || 'Error creando beneficiario')
    } finally {
      setFormLoading(false)
    }
  }

  const header = useMemo(() => (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div>
        <h1 className="font-display font-black text-brand-green-900 text-3xl uppercase tracking-wider">Beneficiarios</h1>
        <p className="text-slate-600 mt-1 font-medium text-sm">Padrón para evitar duplicados y agilizar operativa.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShowForm(true)}
          className="px-5 py-2.5 rounded-xl bg-brand-gold-500 text-brand-green-900 font-bold tracking-wide uppercase text-sm hover:brightness-110 shadow-md hover:shadow-lg transition-all"
        >
          + Nuevo Beneficiario
        </button>
        <button
          onClick={() => apiDownload('/api/export/beneficiaries.xlsx', 'beneficiarios_san_roque.xlsx')}
          className="px-5 py-2.5 rounded-xl bg-white border-2 border-slate-200 shadow-sm font-bold tracking-wide text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all uppercase text-sm"
        >
          Exportar Excel
        </button>
        <label className="px-5 py-2.5 rounded-xl bg-brand-green-900 text-white font-bold tracking-wide uppercase text-sm hover:bg-brand-green-700 transition-all shadow-md hover:shadow-lg cursor-pointer">
          {importing ? 'Importando...' : 'Importar Excel'}
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
                const json = await apiUploadExcel('/api/import/beneficiaries', f)
                setImportResult(json.data)
                const refreshed = await apiGet<{ data: BeneficiaryRow[] }>('/api/beneficiaries')
                setRows(refreshed.data)
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

  if (loading) return <EmptyState icon="⏳" message="Cargando" sub="Leyendo beneficiarios..." />
  if (error) return <EmptyState icon="⚠️" message="Error" sub={error} />
  if (!rows.length) return <EmptyState message="Sin beneficiarios" sub="No hay beneficiarios cargados aún." />

  return (
    <div className="space-y-5">
      {header}

      {importResult && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Importación OK. Creados: <b>{importResult.created}</b>, Actualizados: <b>{importResult.updated}</b>, Omitidos: <b>{importResult.skipped}</b>, Errores: <b>{importResult.errors?.length || 0}</b>
        </div>
      )}

      <div className="bg-white/80 backdrop-blur-md border border-white/60 rounded-[2rem] shadow-card overflow-hidden">
        <div className="overflow-auto scrollbar-hide">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100/50">
              <tr className="text-left text-slate-500 uppercase tracking-wider text-xs">
                <th className="px-5 py-4 font-bold">DNI</th>
                <th className="px-5 py-4 font-bold">Apellido</th>
                <th className="px-5 py-4 font-bold">Nombre</th>
                <th className="px-5 py-4 font-bold">Barrio</th>
                <th className="px-5 py-4 font-bold">Teléfono</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4 font-bold text-brand-green-900">{b.dni}</td>
                  <td className="px-5 py-4 font-semibold text-slate-900">{b.apellido}</td>
                  <td className="px-5 py-4 text-slate-600">{b.nombre}</td>
                  <td className="px-5 py-4 text-slate-500 font-medium">{b.barrio || '-'}</td>
                  <td className="px-5 py-4 text-slate-500">{b.telefono || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <Modal title="Nuevo Beneficiario" onClose={() => setShowForm(false)} size="md">
          <form onSubmit={handleSubmit} className="space-y-4">
             <div className="grid grid-cols-2 gap-4">
               <label className="block col-span-2 sm:col-span-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">DNI</span>
                  <input
                    required
                    maxLength={10}
                    value={formData.dni}
                    onChange={e => setFormData({ ...formData, dni: e.target.value })}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-brand-green-500 focus:border-brand-green-500 outline-none"
                    placeholder="Ej: 30123456"
                  />
               </label>
               <label className="block col-span-2 sm:col-span-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Teléfono</span>
                  <input
                    value={formData.telefono}
                    onChange={e => setFormData({ ...formData, telefono: e.target.value })}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-brand-green-500 focus:border-brand-green-500 outline-none"
                    placeholder="Ej: 3777-123456"
                  />
               </label>
             </div>
             
             <div className="grid grid-cols-2 gap-4">
               <label className="block col-span-2 sm:col-span-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nombre</span>
                  <input
                    required
                    value={formData.nombre}
                    onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-brand-green-500 focus:border-brand-green-500 outline-none"
                    placeholder="Ej: Juan"
                  />
               </label>
               <label className="block col-span-2 sm:col-span-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Apellido</span>
                  <input
                    required
                    value={formData.apellido}
                    onChange={e => setFormData({ ...formData, apellido: e.target.value })}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-brand-green-500 focus:border-brand-green-500 outline-none"
                    placeholder="Ej: Pérez"
                  />
               </label>
             </div>

             <div className="grid grid-cols-2 gap-4">
               <label className="block col-span-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Dirección</span>
                  <input
                    value={formData.direccion}
                    onChange={e => setFormData({ ...formData, direccion: e.target.value })}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-brand-green-500 focus:border-brand-green-500 outline-none"
                    placeholder="Ej: San Martín 123"
                  />
               </label>
               <label className="block col-span-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Barrio</span>
                  <input
                    value={formData.barrio}
                    onChange={e => setFormData({ ...formData, barrio: e.target.value })}
                    className="mt-1 block w-full rounded-xl border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-brand-green-500 focus:border-brand-green-500 outline-none"
                    placeholder="Ej: Centro"
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
                  {formLoading ? 'Guardando...' : 'Guardar Beneficiario'}
                </button>
             </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

