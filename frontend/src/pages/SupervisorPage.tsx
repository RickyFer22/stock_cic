import { useEffect, useState } from 'react'
import EmptyState from '../components/EmptyState'
import HowToCard from '../components/HowToCard'
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

export default function SupervisorPage({ role }: { role: 'admin' | 'supervisor' }) {
  const isAdmin = role === 'admin'
  const [users, setUsers] = useState<UserRow[]>([])
  const [catStats, setCatStats] = useState<StockCategoryStat[]>([])
  const [movStats, setMovStats] = useState<MovementStat[]>([])
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [health, setHealth] = useState<InventoryHealth | null>(null)
  
  const [loadingUsers, setLoadingUsers] = useState(isAdmin)
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
    if (isAdmin) {
      loadUsers()
    } else {
      setLoadingUsers(false)
    }
    loadStats()
  }, [isAdmin])

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

  if (loadingStats || (isAdmin && loadingUsers)) return <EmptyState icon="⏳" message="Cargando" sub="Obteniendo panel de control..." />
  if (error) return <EmptyState icon="⚠️" message="Error" sub={error} />

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display font-extrabold text-ink text-3xl uppercase tracking-wider">Panel de Supervisor</h1>
          <p className="text-ink-2 mt-1 font-medium text-sm">Control de acceso de usuarios y métricas del sistema.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setUserFormData({ role: 'operador', is_active: true, full_name: '', username: '', email: '' })
              setShowUserForm(true)
            }}
            className="px-5 py-2.5 rounded-xl bg-accent-strong text-accent-ink font-bold tracking-wide uppercase text-sm hover:brightness-110 shadow-md transition-all self-start sm:self-auto"
          >
            + Nuevo Usuario
          </button>
        )}
      </div>
      <HowToCard
        title="Guia rapida de supervisor"
        steps={[
          'Paso 1: revisa metricas y alertas para detectar riesgos de stock.',
          'Paso 2: valida actividad de movimientos recientes.',
          isAdmin ? 'Paso 3: administra usuarios desde el bloque final.' : 'Paso 3: solicita a un admin los cambios de usuarios.',
        ]}
      />

      {/* Métricas principales. Antes eran seis tarjetas con seis degradados
          distintos (esmeralda, ámbar, rosa, azul, violeta, cian): el color no
          codificaba nada, solo distinguía una tarjeta de la de al lado. Ahora el
          color aparece únicamente donde significa algo —stock bajo y sin stock
          son los dos únicos números que piden una acción— y el resto queda
          neutro. Ese contraste es lo que hace que las alertas se vean. */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {([
          { n: dashboard?.totalItems, l: 'Total items', tono: 'neutro' },
          { n: health?.lowStock, l: 'Stock bajo', tono: 'warn' },
          { n: health?.outOfStock, l: 'Sin stock', tono: 'danger' },
          { n: dashboard?.totalBeneficiaries, l: 'Beneficiarios', tono: 'neutro' },
          { n: dashboard?.monthlyMovements, l: 'Movimientos mes', tono: 'neutro' },
          { n: dashboard?.weeklyMovements, l: 'Esta semana', tono: 'neutro' },
        ] as const).map(({ n, l, tono }) => {
          const activa = tono !== 'neutro' && (n || 0) > 0
          const clase =
            !activa ? 'bg-paper-2 border-rule text-ink'
            : tono === 'warn' ? 'bg-state-warn-bg border-state-warn/40 text-state-warn'
            : 'bg-state-danger-bg border-state-danger/40 text-state-danger'
          return (
            <div key={l} className={`rounded-[--radius-card] border p-4 shadow-[--shadow-card] ${clase}`}>
              <div className="text-3xl font-black tabular-nums">{n || 0}</div>
              <div className="text-[length:--text-xs] uppercase tracking-wider font-bold mt-0.5">{l}</div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Stock por Categoría */}
        <div className="bg-paper-2 border border-rule rounded-[--radius-card] p-6 shadow-[--shadow-card] flex flex-col">
          <h2 className="text-lg font-bold font-display text-accent tracking-wide uppercase mb-4">Stock por Categoría</h2>
          {!catStats.length ? (
            <div className="my-auto text-center text-ink-3 font-medium py-8">No hay datos de stock.</div>
          ) : (
            <div className="space-y-4 flex-1">
              {catStats.slice(0, 5).map((stat) => {
                const perc = Math.round((Number(stat.stock_total) / maxTotalStock) * 100)
                return (
                  <div key={stat.category} className="group">
                    <div className="flex justify-between text-sm mb-1 font-medium">
                      <span className="text-ink-2">{stat.category}</span>
                      <span className="text-accent font-bold">{stat.stock_total} u.</span>
                    </div>
                    <div className="w-full bg-paper-3 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="bg-accent h-2.5 rounded-full transition-all duration-1000 ease-out flex items-center shadow-inner group-hover:bg-accent-strong" 
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
        <div className="bg-paper-2 border border-rule rounded-[--radius-card] p-6 shadow-[--shadow-card] flex flex-col justify-between">
          <h2 className="text-lg font-bold font-display text-accent tracking-wide uppercase mb-1">Actividad Últimos 30 días</h2>
          <p className="text-ink-3 text-xs font-medium mb-6">Resumen de ingresos y egresos registrados</p>
          
          <div className="grid grid-cols-2 gap-4 flex-1">
            <div className="bg-state-ok-bg rounded-[--radius-card] p-4 flex flex-col justify-center items-center text-center shadow-inner border border-state-ok-bg">
              <span className="text-4xl">📦</span>
              <span className="text-3xl font-black text-state-ok mt-2">
                {movStats.reduce((acc, curr) => acc + Number(curr.inbound), 0)}
              </span>
              <span className="text-xs text-state-ok uppercase tracking-widest font-bold mt-1">Total Ingresos</span>
            </div>
            <div className="bg-state-danger-bg rounded-[--radius-card] p-4 flex flex-col justify-center items-center text-center shadow-inner border border-state-danger-bg">
              <span className="text-4xl">🚚</span>
              <span className="text-3xl font-black text-state-danger mt-2">
                {movStats.reduce((acc, curr) => acc + Number(curr.outbound), 0)}
              </span>
              <span className="text-xs text-state-danger uppercase tracking-widest font-bold mt-1">Total Egresos</span>
            </div>
          </div>
        </div>
      </div>

      {/* Alertas de inventario */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Items con stock bajo */}
        <div className="bg-paper-2 border border-rule rounded-[--radius-card] p-6 shadow-[--shadow-card]">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">⚠️</span>
            <h2 className="text-lg font-bold font-display text-accent tracking-wide uppercase">Items con Stock Bajo</h2>
          </div>
          {health?.itemsLowStock && health.itemsLowStock.length > 0 ? (
            <div className="space-y-3">
              {health.itemsLowStock.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-state-warn-bg rounded-xl border border-state-warn-bg">
                  <div>
                    <div className="font-bold text-ink-2 text-sm">{item.name}</div>
                    <div className="text-xs text-ink-3">{item.code} • {item.category}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-state-warn">{item.stock_actual}</div>
                    <div className="text-xs text-ink-3">mín: {item.stock_minimo}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-state-ok py-6 font-medium">✓ Sin items con stock bajo</div>
          )}
        </div>

        {/* Items por vencer */}
        <div className="bg-paper-2 border border-rule rounded-[--radius-card] p-6 shadow-[--shadow-card]">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">📅</span>
            <h2 className="text-lg font-bold font-display text-accent tracking-wide uppercase">Items por Vencer (30 días)</h2>
          </div>
          {health?.itemsExpiring && health.itemsExpiring.length > 0 ? (
            <div className="space-y-3">
              {health.itemsExpiring.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-state-danger-bg rounded-xl border border-state-danger-bg">
                  <div>
                    <div className="font-bold text-ink-2 text-sm">{item.name}</div>
                    <div className="text-xs text-ink-3">{item.code}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-state-danger">{item.stock_actual}</div>
                    <div className="text-xs text-state-danger font-bold">{new Date(item.expiry_date).toLocaleDateString('es-AR')}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-state-ok py-6 font-medium">✓ Sin items por vencer</div>
          )}
        </div>
      </div>

      {/* Movimientos recientes */}
      <div className="bg-paper-2 border border-rule rounded-[--radius-card] shadow-[--shadow-card] overflow-hidden">
        <div className="px-6 py-5 border-b border-rule">
          <h2 className="text-lg font-bold font-display text-accent tracking-wide uppercase">Movimientos Recientes</h2>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-paper-2/50">
              <tr className="text-left text-ink-3 uppercase tracking-wider text-xs">
                <th className="px-5 py-4 font-bold">Fecha</th>
                <th className="px-5 py-4 font-bold">Tipo</th>
                <th className="px-5 py-4 font-bold">Item</th>
                <th className="px-5 py-4 font-bold">Cantidad</th>
                <th className="px-5 py-4 font-bold">Operador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {dashboard?.recentMovements && dashboard.recentMovements.length > 0 ? (
                dashboard.recentMovements.map(m => (
                  <tr key={m.id} className="hover:bg-paper-3/50">
                    <td className="px-5 py-3 text-ink-2 font-medium">{formatDate(m.fecha)}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${
                        m.kind === 'INGRESO' ? 'bg-state-ok-bg text-state-ok' :
                        m.kind === 'DISTRIBUTION' ? 'bg-state-danger-bg text-state-danger' :
                        'bg-state-info-bg text-state-info'
                      }`}>
                        {m.kind}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium text-ink-2">{m.item_name}</td>
                    <td className={`px-5 py-3 font-bold ${m.quantity > 0 ? 'text-state-ok' : 'text-state-danger'}`}>
                      {m.quantity > 0 ? '+' : ''}{m.quantity}
                    </td>
                    <td className="px-5 py-3 text-ink-2">{m.operador}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-ink-3">Sin movimientos recientes</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Control de Usuarios */}
      {isAdmin ? (
        <div className="bg-paper-2 border border-rule rounded-[--radius-card] shadow-[--shadow-card] overflow-hidden">
          <div className="px-6 py-5 border-b border-rule flex items-center justify-between">
            <h2 className="text-lg font-bold font-display text-accent tracking-wide uppercase">Control de Usuarios</h2>
            <span className="bg-paper-3 text-ink-2 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">{users.length} Registros</span>
          </div>
          <div className="overflow-auto scrollbar-hide">
            <table className="min-w-full text-sm">
              <thead className="bg-paper-2/50">
                <tr className="text-left text-ink-3 uppercase tracking-wider text-xs">
                  <th className="px-5 py-4 font-bold">Usuario</th>
                  <th className="px-5 py-4 font-bold">Nombre Completo</th>
                  <th className="px-5 py-4 font-bold">Rol</th>
                  <th className="px-5 py-4 font-bold">Estado</th>
                  <th className="px-5 py-4 font-bold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-paper-3/50 transition-colors">
                    <td className="px-5 py-4 font-bold text-accent">{u.username}</td>
                    <td className="px-5 py-4 text-ink-2">{u.full_name}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-widest uppercase items-center ${
                        u.role === 'admin' ? 'bg-state-danger-bg text-state-danger' :
                        u.role === 'supervisor' ? 'bg-state-warn-bg text-state-warn' :
                        'bg-paper-3 text-ink-2'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {u.is_active ? (
                        <span className="text-state-ok font-bold bg-state-ok-bg px-2 py-1 flex items-center w-max rounded-md text-xs uppercase tracking-wider"><span className="w-2 h-2 rounded-full bg-state-ok-bg0 mr-2"></span>Activo</span>
                      ) : (
                        <span className="text-state-danger font-bold bg-state-danger-bg px-2 py-1 flex items-center w-max rounded-md text-xs uppercase tracking-wider"><span className="w-2 h-2 rounded-full bg-state-danger-bg0 mr-2"></span>Inactivo</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => {
                          setUserFormData({ ...u, password: '' })
                          setShowUserForm(true)
                        }}
                        className="text-accent hover:text-accent font-bold text-xs uppercase tracking-widest border border-accent/25 px-3 py-1.5 rounded-lg hover:bg-accent-soft transition-all"
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
      ) : (
        <div className="rounded-[--radius-card] border border-state-warn/25 bg-state-warn-bg px-4 py-3 text-sm text-state-warn font-medium">
          Gestion de usuarios disponible solo para rol admin.
        </div>
      )}

      {showUserForm && (
        <Modal title={userFormData.id ? "Editar Usuario" : "Nuevo Usuario"} onClose={() => setShowUserForm(false)}>
          <form onSubmit={handleSaveUser} className="space-y-4">
            {formError && <div className="text-state-danger text-sm font-bold bg-state-danger-bg p-3 rounded-xl border border-state-danger-bg">{formError}</div>}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-ink-3 uppercase tracking-wider mb-2">Usuario (Login)</label>
                <input 
                  autoFocus
                  required
                  className="w-full bg-paper-2 border border-rule rounded-xl px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-focus/30 transition-all font-medium text-ink-2"
                  value={userFormData.username || ''}
                  onChange={e => setUserFormData({...userFormData, username: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-3 uppercase tracking-wider mb-2">Contraseña</label>
                <input 
                  type="password"
                  placeholder={userFormData.id ? "(Dejar vacío para no cambiar)" : "Requerida"}
                  required={!userFormData.id}
                  className="w-full bg-paper-2 border border-rule rounded-xl px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-focus/30 transition-all font-medium text-ink-2"
                  value={userFormData.password || ''}
                  onChange={e => setUserFormData({...userFormData, password: e.target.value})}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-ink-3 uppercase tracking-wider mb-2">Nombre Completo</label>
                <input 
                  required
                  className="w-full bg-paper-2 border border-rule rounded-xl px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-focus/30 transition-all font-medium text-ink-2"
                  value={userFormData.full_name || ''}
                  onChange={e => setUserFormData({...userFormData, full_name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-3 uppercase tracking-wider mb-2">Email (Opcional)</label>
                <input 
                  type="email"
                  className="w-full bg-paper-2 border border-rule rounded-xl px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-focus/30 transition-all font-medium text-ink-2"
                  value={userFormData.email || ''}
                  onChange={e => setUserFormData({...userFormData, email: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-3 uppercase tracking-wider mb-2">Rol</label>
                <select 
                  className="w-full bg-paper-2 border border-rule rounded-xl px-4 py-2.5 outline-none focus:border-accent focus:ring-2 focus:ring-focus/30 transition-all font-medium text-ink-2"
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
              <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border border-rule hover:bg-paper-3 transition-colors">
                <input 
                  type="checkbox" 
                  className="w-5 h-5 accent-[--color-accent]"
                  checked={userFormData.is_active}
                  onChange={e => setUserFormData({...userFormData, is_active: e.target.checked})}
                />
                <div className="select-none">
                  <span className="block text-sm font-bold text-ink-2">Usuario Activo</span>
                  <span className="block text-xs text-ink-3 font-medium mt-0.5">Permite el acceso al sistema</span>
                </div>
              </label>
            </div>

            <div className="flex gap-3 justify-end pt-5 border-t border-rule mt-6">
              <button 
                type="button" 
                onClick={() => setShowUserForm(false)} 
                className="px-5 py-2.5 text-sm font-bold tracking-wide uppercase text-ink-3 hover:bg-paper-3 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                className="px-6 py-2.5 text-sm font-bold tracking-wide uppercase bg-accent-strong text-accent-ink hover:brightness-110 rounded-xl shadow-md transition-all"
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
