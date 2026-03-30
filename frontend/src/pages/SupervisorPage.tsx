import { useEffect, useState } from 'react'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import { apiGet, apiPost, apiPut } from '../api/client'

type UserRow = {
  id: string
  username: string
  full_name: string
  email: string | null
  role: 'admin' | 'supervisor' | 'operador'
  is_active: boolean
  created_at: string
}

type StockCategoryStat = {
  category: string
  stock_total: string | number
  items_count: string | number
}

type MovementStat = {
  day: string
  inbound: string | number
  outbound: string | number
  movements: string | number
}

type DashboardSummary = {
  totalItems: number
  lowStockItems: number
  totalBeneficiaries: number
  monthlyMovements: number
  weeklyMovements: number
  topItems: Array<{ id: string; name: string; stock_actual: number; stock_minimo: number; category: string }>
  recentMovements: Array<{ id: string; fecha: string; kind: string; quantity: number; item_name: string; operador: string }>
}

type InventoryHealth = {
  total: number
  lowStock: number
  outOfStock: number
  overStock: number
  expiringSoon: number
  itemsLowStock: Array<{ id: string; name: string; code: string; stock_actual: number; stock_minimo: number; category: string }>
  itemsExpiring: Array<{ id: string; name: string; code: string; stock_actual: number; expiry_date: string }>
}

export default function SupervisorPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [catStats, setCatStats] = useState<StockCategoryStat[]>([])
  const [movStats, setMovStats] = useState<MovementStat[]>([])
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [health, setHealth] = useState<InventoryHealth | null>(null)
  
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingStats, setLoadingStats] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [showUserForm, setShowUserForm] = useState(false)
  const [userFormData, setUserFormData] = useState<Partial<UserRow> & { password?: string }>({
    role: 'operador',
    is_active: true
  })
  const [formError, setFormError] = useState<string | null>(null)

  const loadUsers = () => {
    setLoadingUsers(true)
    apiGet<{ data: UserRow[] }>('/api/users')
      .then(res => {
        setUsers(res.data)
      })
      .catch(err => {
        setError('Error Usuarios: ' + err.message)
      })
      .finally(() => setLoadingUsers(false))
  }

  const loadStats = () => {
    setLoadingStats(true)
    const today = new Date()
    const fromDate = new Date()
    fromDate.setDate(today.getDate() - 30)
    
    const fromStr = fromDate.toISOString().slice(0, 10)
    const toStr = today.toISOString().slice(0, 10)

    Promise.all([
      apiGet<{ data: StockCategoryStat[] }>('/api/statistics/stock-by-category'),
      apiGet<{ data: MovementStat[] }>(`/api/statistics/movements?from=${fromStr}&to=${toStr}`),
      apiGet<{ data: DashboardSummary }>('/api/statistics/dashboard'),
      apiGet<{ data: InventoryHealth }>('/api/statistics/health'),
    ])
    .then(([catRes, movRes, dashRes, healthRes]) => {
      setCatStats(catRes.data)
      setMovStats(movRes.data)
      setDashboard(dashRes.data)
      setHealth(healthRes.data)
    })
    .catch(err => {
      console.error('Error loading stats:', err)
      setError('Error Estadísticas: ' + err.message)
    })
    .finally(() => setLoadingStats(false))
  }

  useEffect(() => {
    loadUsers()
    loadStats()
  }, [])

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    try {
      if (userFormData.id) {
        await apiPut(`/api/users/${userFormData.id}`, userFormData)
      } else {
        await apiPost('/api/users', userFormData)
      }
      setShowUserForm(false)
      loadUsers()
    } catch (err: any) {
      setFormError(err.message || 'Error guardando usuario')
    }
  }

  const maxTotalStock = Math.max(1, ...catStats.map(s => Number(s.stock_total)))
  const totalMovements = movStats.reduce((acc, curr) => acc + Number(curr.inbound) + Number(curr.outbound), 0)

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  if (loadingUsers && loadingStats) return <EmptyState icon="⏳" message="Cargando" sub="Obteniendo panel de control..." />
  if (error) return <EmptyState icon="⚠️" message="Error" sub={error} />

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-black text-brand-green-900 text-3xl uppercase tracking-wider">Panel de Supervisor</h1>
          <p className="text-slate-600 mt-1 font-medium text-sm">Control de acceso de usuarios y métricas del sistema.</p>
        </div>
        <button
          onClick={() => {
            setUserFormData({ role: 'operador', is_active: true, full_name: '', username: '', email: '' })
            setShowUserForm(true)
          }}
          className="px-5 py-2.5 rounded-xl bg-brand-gold-500 text-brand-green-900 font-bold tracking-wide uppercase text-sm hover:brightness-110 shadow-md transition-all self-start sm:self-auto"
        >
          + Nuevo Usuario
        </button>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-4 text-white shadow-lg">
          <div className="text-3xl font-black">{dashboard?.totalItems || 0}</div>
          <div className="text-xs uppercase tracking-wider font-bold opacity-90">Total Items</div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-4 text-white shadow-lg">
          <div className="text-3xl font-black">{health?.lowStock || 0}</div>
          <div className="text-xs uppercase tracking-wider font-bold opacity-90">Stock Bajo</div>
        </div>
        <div className="bg-gradient-to-br from-rose-500 to-pink-500 rounded-2xl p-4 text-white shadow-lg">
          <div className="text-3xl font-black">{health?.outOfStock || 0}</div>
          <div className="text-xs uppercase tracking-wider font-bold opacity-90">Sin Stock</div>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl p-4 text-white shadow-lg">
          <div className="text-3xl font-black">{dashboard?.totalBeneficiaries || 0}</div>
          <div className="text-xs uppercase tracking-wider font-bold opacity-90">Beneficiarios</div>
        </div>
        <div className="bg-gradient-to-br from-violet-500 to-purple-500 rounded-2xl p-4 text-white shadow-lg">
          <div className="text-3xl font-black">{dashboard?.monthlyMovements || 0}</div>
          <div className="text-xs uppercase tracking-wider font-bold opacity-90">Movimientos Mes</div>
        </div>
        <div className="bg-gradient-to-br from-cyan-500 to-teal-500 rounded-2xl p-4 text-white shadow-lg">
          <div className="text-3xl font-black">{dashboard?.weeklyMovements || 0}</div>
          <div className="text-xs uppercase tracking-wider font-bold opacity-90">Esta Semana</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Stock por Categoría */}
        <div className="bg-white/80 backdrop-blur-md border border-white/60 rounded-[2rem] p-6 shadow-card flex flex-col">
          <h2 className="text-lg font-bold font-display text-brand-green-900 tracking-wide uppercase mb-4">Stock por Categoría</h2>
          {!catStats.length ? (
            <div className="my-auto text-center text-slate-400 font-medium py-8">No hay datos de stock.</div>
          ) : (
            <div className="space-y-4 flex-1">
              {catStats.slice(0, 5).map((stat) => {
                const perc = Math.round((Number(stat.stock_total) / maxTotalStock) * 100)
                return (
                  <div key={stat.category} className="group">
                    <div className="flex justify-between text-sm mb-1 font-medium">
                      <span className="text-slate-700">{stat.category}</span>
                      <span className="text-brand-green-800 font-bold">{stat.stock_total} u.</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="bg-brand-green-500 h-2.5 rounded-full transition-all duration-1000 ease-out flex items-center shadow-inner group-hover:bg-brand-gold-400" 
                        style={{ width: `${perc}%` }}
                      ></div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Métrica 2: Resumen del Mes */}
        <div className="bg-white/80 backdrop-blur-md border border-white/60 rounded-[2rem] p-6 shadow-card flex flex-col justify-between">
          <h2 className="text-lg font-bold font-display text-brand-green-900 tracking-wide uppercase mb-1">Actividad Últimos 30 días</h2>
          <p className="text-slate-500 text-xs font-medium mb-6">Resumen de ingresos y egresos registrados</p>
          
          <div className="grid grid-cols-2 gap-4 flex-1">
            <div className="bg-emerald-50 rounded-2xl p-4 flex flex-col justify-center items-center text-center shadow-inner border border-emerald-100">
              <span className="text-4xl">📦</span>
              <span className="text-3xl font-black text-emerald-600 mt-2">
                {movStats.reduce((acc, curr) => acc + Number(curr.inbound), 0)}
              </span>
              <span className="text-xs text-emerald-800 uppercase tracking-widest font-bold mt-1">Total Ingresos</span>
            </div>
            <div className="bg-rose-50 rounded-2xl p-4 flex flex-col justify-center items-center text-center shadow-inner border border-rose-100">
              <span className="text-4xl">🚚</span>
              <span className="text-3xl font-black text-rose-600 mt-2">
                {movStats.reduce((acc, curr) => acc + Number(curr.outbound), 0)}
              </span>
              <span className="text-xs text-rose-800 uppercase tracking-widest font-bold mt-1">Total Egresos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alertas de inventario */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Items con stock bajo */}
        <div className="bg-white/80 backdrop-blur-md border border-white/60 rounded-[2rem] p-6 shadow-card">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">⚠️</span>
            <h2 className="text-lg font-bold font-display text-brand-green-900 tracking-wide uppercase">Items con Stock Bajo</h2>
          </div>
          {health?.itemsLowStock && health.itemsLowStock.length > 0 ? (
            <div className="space-y-3">
              {health.itemsLowStock.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <div>
                    <div className="font-bold text-slate-700 text-sm">{item.name}</div>
                    <div className="text-xs text-slate-500">{item.code} • {item.category}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-amber-600">{item.stock_actual}</div>
                    <div className="text-xs text-slate-500">mín: {item.stock_minimo}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-emerald-600 py-6 font-medium">✓ Sin items con stock bajo</div>
          )}
        </div>

        {/* Items por vencer */}
        <div className="bg-white/80 backdrop-blur-md border border-white/60 rounded-[2rem] p-6 shadow-card">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">📅</span>
            <h2 className="text-lg font-bold font-display text-brand-green-900 tracking-wide uppercase">Items por Vencer (30 días)</h2>
          </div>
          {health?.itemsExpiring && health.itemsExpiring.length > 0 ? (
            <div className="space-y-3">
              {health.itemsExpiring.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-rose-50 rounded-xl border border-rose-100">
                  <div>
                    <div className="font-bold text-slate-700 text-sm">{item.name}</div>
                    <div className="text-xs text-slate-500">{item.code}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-rose-600">{item.stock_actual}</div>
                    <div className="text-xs text-rose-600 font-bold">{new Date(item.expiry_date).toLocaleDateString('es-AR')}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-emerald-600 py-6 font-medium">✓ Sin items por vencer</div>
          )}
        </div>
      </div>

      {/* Movimientos recientes */}
      <div className="bg-white/80 backdrop-blur-md border border-white/60 rounded-[2rem] shadow-card overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold font-display text-brand-green-900 tracking-wide uppercase">Movimientos Recientes</h2>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/50">
              <tr className="text-left text-slate-500 uppercase tracking-wider text-xs">
                <th className="px-5 py-4 font-bold">Fecha</th>
                <th className="px-5 py-4 font-bold">Tipo</th>
                <th className="px-5 py-4 font-bold">Item</th>
                <th className="px-5 py-4 font-bold">Cantidad</th>
                <th className="px-5 py-4 font-bold">Operador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dashboard?.recentMovements && dashboard.recentMovements.length > 0 ? (
                dashboard.recentMovements.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3 text-slate-600 font-medium">{formatDate(m.fecha)}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${
                        m.kind === 'INGRESO' ? 'bg-emerald-100 text-emerald-700' :
                        m.kind === 'DISTRIBUTION' ? 'bg-rose-100 text-rose-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {m.kind}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-700">{m.item_name}</td>
                    <td className={`px-5 py-3 font-bold ${m.quantity > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {m.quantity > 0 ? '+' : ''}{m.quantity}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{m.operador}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">Sin movimientos recientes</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Control de Usuarios */}
      <div className="bg-white/80 backdrop-blur-md border border-white/60 rounded-[2rem] shadow-card overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold font-display text-brand-green-900 tracking-wide uppercase">Control de Usuarios</h2>
          <span className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">{users.length} Registros</span>
        </div>
        <div className="overflow-auto scrollbar-hide">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50/50">
              <tr className="text-left text-slate-500 uppercase tracking-wider text-xs">
                <th className="px-5 py-4 font-bold">Usuario</th>
                <th className="px-5 py-4 font-bold">Nombre Completo</th>
                <th className="px-5 py-4 font-bold">Rol</th>
                <th className="px-5 py-4 font-bold">Estado</th>
                <th className="px-5 py-4 font-bold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-4 font-bold text-brand-green-900">{u.username}</td>
                  <td className="px-5 py-4 text-slate-700">{u.full_name}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-widest uppercase items-center ${
                      u.role === 'admin' ? 'bg-rose-100 text-rose-700' :
                      u.role === 'supervisor' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {u.is_active ? (
                      <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 flex items-center w-max rounded-md text-xs uppercase tracking-wider"><span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span>Activo</span>
                    ) : (
                      <span className="text-rose-600 font-bold bg-rose-50 px-2 py-1 flex items-center w-max rounded-md text-xs uppercase tracking-wider"><span className="w-2 h-2 rounded-full bg-rose-500 mr-2"></span>Inactivo</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button 
                      onClick={() => {
                        setUserFormData({ ...u, password: '' })
                        setShowUserForm(true)
                      }}
                      className="text-brand-green-600 hover:text-brand-green-800 font-bold text-xs uppercase tracking-widest border border-brand-green-200 px-3 py-1.5 rounded-lg hover:bg-brand-green-50 transition-all"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showUserForm && (
        <Modal title={userFormData.id ? "Editar Usuario" : "Nuevo Usuario"} onClose={() => setShowUserForm(false)}>
          <form onSubmit={handleSaveUser} className="space-y-4">
            {formError && <div className="text-rose-600 text-sm font-bold bg-rose-50 p-3 rounded-xl border border-rose-100">{formError}</div>}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Usuario (Login)</label>
                <input 
                  autoFocus
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-green-600 focus:ring-2 focus:ring-brand-green-100 transition-all font-medium text-slate-700"
                  value={userFormData.username || ''}
                  onChange={e => setUserFormData({...userFormData, username: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Contraseña</label>
                <input 
                  type="password"
                  placeholder={userFormData.id ? "(Dejar vacío para no cambiar)" : "Requerida"}
                  required={!userFormData.id}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-green-600 focus:ring-2 focus:ring-brand-green-100 transition-all font-medium text-slate-700"
                  value={userFormData.password || ''}
                  onChange={e => setUserFormData({...userFormData, password: e.target.value})}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nombre Completo</label>
                <input 
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-green-600 focus:ring-2 focus:ring-brand-green-100 transition-all font-medium text-slate-700"
                  value={userFormData.full_name || ''}
                  onChange={e => setUserFormData({...userFormData, full_name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email (Opcional)</label>
                <input 
                  type="email"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-green-600 focus:ring-2 focus:ring-brand-green-100 transition-all font-medium text-slate-700"
                  value={userFormData.email || ''}
                  onChange={e => setUserFormData({...userFormData, email: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Rol</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-brand-green-600 focus:ring-2 focus:ring-brand-green-100 transition-all font-medium text-slate-700"
                  value={userFormData.role || 'operador'}
                  onChange={e => setUserFormData({...userFormData, role: e.target.value as any})}
                >
                  <option value="operador">Operador (Básico)</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
                <input 
                  type="checkbox" 
                  className="w-5 h-5 accent-brand-green-600"
                  checked={userFormData.is_active}
                  onChange={e => setUserFormData({...userFormData, is_active: e.target.checked})}
                />
                <div className="select-none">
                  <span className="block text-sm font-bold text-slate-700">Usuario Activo</span>
                  <span className="block text-xs text-slate-500 font-medium mt-0.5">Permite el acceso al sistema</span>
                </div>
              </label>
            </div>

            <div className="flex gap-3 justify-end pt-5 border-t border-slate-100 mt-6">
              <button 
                type="button" 
                onClick={() => setShowUserForm(false)} 
                className="px-5 py-2.5 text-sm font-bold tracking-wide uppercase text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="px-6 py-2.5 text-sm font-bold tracking-wide uppercase bg-brand-green-900 text-white hover:brightness-110 rounded-xl shadow-md transition-all"
              >
                Guardar Usuario
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}