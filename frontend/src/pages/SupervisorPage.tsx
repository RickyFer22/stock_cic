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

type AuditLogRow = {
  id: string
  timestamp: string
  action: string
  entity_type: string
  entity_id: string | null
  old_values: any
  new_values: any
  ip: string | null
  user_agent: string | null
  username: string | null
  user_full_name: string | null
}

export default function SupervisorPage({ role }: { role: 'admin' | 'supervisor' }) {
  const isAdmin = role === 'admin'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'audit' | 'users'>('dashboard')

  // Datos del Dashboard
  const [catStats, setCatStats] = useState<StockCategoryStat[]>([])
  const [movStats, setMovStats] = useState<MovementStat[]>([])
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [health, setHealth] = useState<InventoryHealth | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  // Datos de Usuarios
  const [users, setUsers] = useState<UserRow[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [showUserForm, setShowUserForm] = useState(false)
  const [userFormData, setUserFormData] = useState<Partial<UserRow> & { password?: string }>({
    role: 'operador',
    is_active: true
  })
  const [userFormError, setUserFormError] = useState<string | null>(null)

  // Datos del Log de Auditoría
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([])
  const [loadingAudit, setLoadingAudit] = useState(false)
  const [auditSearch, setAuditSearch] = useState('')
  const [auditActionFilter, setAuditActionFilter] = useState<string>('todos')
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLogRow | null>(null)

  const [error, setError] = useState<string | null>(null)

  const loadUsers = () => {
    setLoadingUsers(true)
    apiGet<{ data: UserRow[] }>('/api/users')
      .then(res => setUsers(res.data))
      .catch(err => setError('Error Usuarios: ' + err.message))
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

  const loadAuditLogs = () => {
    setLoadingAudit(true)
    const params = new URLSearchParams()
    if (auditSearch.trim()) params.append('search', auditSearch.trim())
    if (auditActionFilter !== 'todos') params.append('action', auditActionFilter)

    apiGet<{ data: AuditLogRow[] }>(`/api/audit-logs?${params.toString()}`)
      .then(res => setAuditLogs(res.data))
      .catch(err => console.error('Error cargando audit logs:', err))
      .finally(() => setLoadingAudit(false))
  }

  useEffect(() => {
    loadStats()
    if (isAdmin) loadUsers()
    loadAuditLogs()
  }, [isAdmin])

  useEffect(() => {
    if (activeTab === 'audit') loadAuditLogs()
  }, [auditSearch, auditActionFilter, activeTab])

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setUserFormError(null)
    try {
      if (userFormData.id) {
        await apiPut(`/api/users/${userFormData.id}`, userFormData)
      } else {
        await apiPost('/api/users', userFormData)
      }
      setShowUserForm(false)
      loadUsers()
    } catch (err: any) {
      setUserFormError(err.message || 'Error guardando usuario')
    }
  }

  const maxTotalStock = Math.max(1, ...catStats.map(s => Number(s.stock_total)))

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  const filteredUsers = users.filter(u => {
    if (!userSearch.trim()) return true
    const q = userSearch.toLowerCase()
    return u.username.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q)
  })

  if (loadingStats && !dashboard) return <EmptyState icon="⏳" message="Cargando" sub="Obteniendo panel de control..." />
  if (error) return <EmptyState icon="⚠️" message="Error" sub={error} />

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-paper-2 border border-rule rounded-[--radius-card] p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display font-extrabold text-ink text-2xl uppercase tracking-wider">Panel de Supervisor</h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-accent-soft text-accent">
              {role}
            </span>
          </div>
          <p className="text-ink-2 mt-1 font-medium text-sm">Control ejecutivo de métricas, log de auditoría y gestión de acceso.</p>
        </div>

        {/* Pestañas de navegación */}
        <div className="flex items-center gap-1 bg-paper-3 p-1.5 rounded-xl border border-rule self-start md:self-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === 'dashboard'
                ? 'bg-paper text-accent shadow-sm font-black'
                : 'text-ink-3 hover:text-ink hover:bg-paper/50'
            }`}
          >
            📊 Panel General
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === 'audit'
                ? 'bg-paper text-accent shadow-sm font-black'
                : 'text-ink-3 hover:text-ink hover:bg-paper/50'
            }`}
          >
            📜 Log de Auditoría
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === 'users'
                  ? 'bg-paper text-accent shadow-sm font-black'
                  : 'text-ink-3 hover:text-ink hover:bg-paper/50'
              }`}
            >
              👤 Usuarios ({users.length})
            </button>
          )}
        </div>
      </div>

      <HowToCard
        title="Guía rápida del centro de supervisión"
        steps={[
          'Panel General: monitorea métricas en tiempo real, alertas de stock e historial de movimientos.',
          'Log de Auditoría: revisa el historial completo de cambios con usuarios, fechas y datos modificados.',
          isAdmin ? 'Gestión de Usuarios: crea y edita cuentas y permisos de operarios.' : 'Gestión de Usuarios: requiere rol de Administrador.',
        ]}
      />

      {/* PESTAÑA 1: PANEL GENERAL */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Métricas Principales */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {([
              { n: dashboard?.totalItems, l: 'Total artículos', tono: 'neutro', icono: '📦' },
              { n: health?.lowStock, l: 'Stock bajo', tono: 'warn', icono: '⚠️' },
              { n: health?.outOfStock, l: 'Sin stock', tono: 'danger', icono: '🚫' },
              { n: dashboard?.totalBeneficiaries, l: 'Beneficiarios', tono: 'neutro', icono: '👥' },
              { n: dashboard?.monthlyMovements, l: 'Movimientos mes', tono: 'neutro', icono: '🔄' },
              { n: dashboard?.weeklyMovements, l: 'Esta semana', tono: 'neutro', icono: '📅' },
            ] as const).map(({ n, l, tono, icono }) => {
              const activa = tono !== 'neutro' && (n || 0) > 0
              const clase =
                !activa ? 'bg-paper-2 border-rule text-ink'
                : tono === 'warn' ? 'bg-state-warn-bg border-state-warn/40 text-state-warn'
                : 'bg-state-danger-bg border-state-danger/40 text-state-danger'
              return (
                <div key={l} className={`rounded-[--radius-card] border p-4 shadow-[--shadow-card] ${clase} transition-all hover:shadow-md`}>
                  <div className="flex justify-between items-start">
                    <div className="text-3xl font-black tabular-nums">{n || 0}</div>
                    <span className="text-lg opacity-80">{icono}</span>
                  </div>
                  <div className="text-[length:--text-xs] uppercase tracking-wider font-bold mt-1">{l}</div>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stock por Categoría */}
            <div className="bg-paper-2 border border-rule rounded-[--radius-card] p-6 shadow-[--shadow-card] flex flex-col">
              <h2 className="text-base font-bold font-display text-accent tracking-wide uppercase mb-4 flex items-center justify-between">
                <span>Stock por Categoría</span>
                <span className="text-xs font-semibold text-ink-3 uppercase">{catStats.length} Categorías</span>
              </h2>
              {!catStats.length ? (
                <div className="my-auto text-center text-ink-3 font-medium py-8">No hay datos de stock.</div>
              ) : (
                <div className="space-y-4 flex-1">
                  {catStats.slice(0, 6).map((stat) => {
                    const perc = Math.round((Number(stat.stock_total) / maxTotalStock) * 100)
                    return (
                      <div key={stat.category} className="group">
                        <div className="flex justify-between text-xs mb-1.5 font-medium">
                          <span className="text-ink font-semibold">{stat.category}</span>
                          <span className="text-accent font-bold tabular-nums">{stat.stock_total} u. ({stat.items_count} arts.)</span>
                        </div>
                        <div className="w-full bg-paper-3 rounded-full h-2.5 overflow-hidden">
                          <div 
                            className="bg-accent h-2.5 rounded-full transition-all duration-700 ease-out shadow-inner group-hover:bg-accent-strong" 
                            style={{ width: `${Math.max(5, perc)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Actividad Últimos 30 días */}
            <div className="bg-paper-2 border border-rule rounded-[--radius-card] p-6 shadow-[--shadow-card] flex flex-col justify-between">
              <div className="mb-4">
                <h2 className="text-base font-bold font-display text-accent tracking-wide uppercase">Actividad Últimos 30 Días</h2>
                <p className="text-ink-3 text-xs font-medium mt-0.5">Volumen total de rotación en depósito</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 flex-1">
                <div className="bg-state-ok-bg/70 rounded-[--radius-card] p-5 flex flex-col justify-center items-center text-center border border-state-ok/20">
                  <span className="text-3xl">📥</span>
                  <span className="text-3xl font-black text-state-ok mt-2 tabular-nums">
                    {movStats.reduce((acc, curr) => acc + Number(curr.inbound), 0)}
                  </span>
                  <span className="text-xs text-state-ok uppercase tracking-widest font-bold mt-1">Total Ingresos</span>
                </div>
                <div className="bg-state-danger-bg/70 rounded-[--radius-card] p-5 flex flex-col justify-center items-center text-center border border-state-danger/20">
                  <span className="text-3xl">📤</span>
                  <span className="text-3xl font-black text-state-danger mt-2 tabular-nums">
                    {movStats.reduce((acc, curr) => acc + Number(curr.outbound), 0)}
                  </span>
                  <span className="text-xs text-state-danger uppercase tracking-widest font-bold mt-1">Total Egresos</span>
                </div>
              </div>
            </div>
          </div>

          {/* Alertas de inventario */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-paper-2 border border-rule rounded-[--radius-card] p-6 shadow-[--shadow-card]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">⚠️</span>
                  <h2 className="text-base font-bold font-display text-accent tracking-wide uppercase">Artículos con Stock Bajo</h2>
                </div>
                {health?.itemsLowStock && health.itemsLowStock.length > 0 && (
                  <span className="bg-state-warn-bg text-state-warn text-xs font-bold px-2.5 py-0.5 rounded-full uppercase">
                    {health.itemsLowStock.length} Alertas
                  </span>
                )}
              </div>
              {health?.itemsLowStock && health.itemsLowStock.length > 0 ? (
                <div className="space-y-2.5">
                  {health.itemsLowStock.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-state-warn-bg/40 rounded-xl border border-state-warn/25">
                      <div>
                        <div className="font-bold text-ink text-sm">{item.name}</div>
                        <div className="text-xs text-ink-3">{item.code} • {item.category || 'Sin Cat.'}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-black text-state-warn tabular-nums">{item.stock_actual} u.</div>
                        <div className="text-[11px] text-ink-3 font-semibold">Mín: {item.stock_minimo}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-state-ok py-8 font-medium">✓ Sin artículos en stock crítico</div>
              )}
            </div>

            <div className="bg-paper-2 border border-rule rounded-[--radius-card] p-6 shadow-[--shadow-card]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📅</span>
                  <h2 className="text-base font-bold font-display text-accent tracking-wide uppercase">Próximos a Vencer (30 días)</h2>
                </div>
                {health?.itemsExpiring && health.itemsExpiring.length > 0 && (
                  <span className="bg-state-danger-bg text-state-danger text-xs font-bold px-2.5 py-0.5 rounded-full uppercase">
                    {health.itemsExpiring.length} Vencimientos
                  </span>
                )}
              </div>
              {health?.itemsExpiring && health.itemsExpiring.length > 0 ? (
                <div className="space-y-2.5">
                  {health.itemsExpiring.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-state-danger-bg/40 rounded-xl border border-state-danger/25">
                      <div>
                        <div className="font-bold text-ink text-sm">{item.name}</div>
                        <div className="text-xs text-ink-3">{item.code}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-black text-state-danger tabular-nums">{item.stock_actual} u.</div>
                        <div className="text-[11px] text-state-danger font-bold">{new Date(item.expiry_date).toLocaleDateString('es-AR')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-state-ok py-8 font-medium">✓ Sin artículos próximos a vencer</div>
              )}
            </div>
          </div>

          {/* Movimientos Recientes */}
          <div className="bg-paper-2 border border-rule rounded-[--radius-card] shadow-[--shadow-card] overflow-hidden">
            <div className="px-6 py-4 border-b border-rule flex items-center justify-between">
              <h2 className="text-base font-bold font-display text-accent tracking-wide uppercase">Movimientos Recientes</h2>
              <span className="text-xs font-semibold text-ink-3 uppercase">Últimas 10 operaciones</span>
            </div>
            <div className="overflow-auto scrollbar-hide">
              <table className="min-w-full text-sm">
                <thead className="bg-paper-3">
                  <tr className="text-left text-ink-3 uppercase tracking-wider text-xs">
                    <th className="px-5 py-3.5 font-bold">Fecha</th>
                    <th className="px-5 py-3.5 font-bold">Tipo</th>
                    <th className="px-5 py-3.5 font-bold">Artículo</th>
                    <th className="px-5 py-3.5 font-bold text-right">Cantidad</th>
                    <th className="px-5 py-3.5 font-bold">Operador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {dashboard?.recentMovements && dashboard.recentMovements.length > 0 ? (
                    dashboard.recentMovements.map(m => (
                      <tr key={m.id} className="hover:bg-paper-3/50 transition-colors">
                        <td className="px-5 py-3 text-ink-2 font-medium text-xs">{formatDate(m.fecha)}</td>
                        <td className="px-5 py-3">
                          <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                            m.kind === 'INGRESO' ? 'bg-state-ok-bg text-state-ok' :
                            m.kind === 'DISTRIBUTION' ? 'bg-state-danger-bg text-state-danger' :
                            'bg-state-info-bg text-state-info'
                          }`}>
                            {m.kind}
                          </span>
                        </td>
                        <td className="px-5 py-3 font-semibold text-ink">{m.item_name}</td>
                        <td className={`px-5 py-3 text-right font-black tabular-nums ${m.quantity > 0 ? 'text-state-ok' : 'text-state-danger'}`}>
                          {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                        </td>
                        <td className="px-5 py-3 text-ink-2 font-medium text-xs">{m.operador}</td>
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
        </div>
      )}

      {/* PESTAÑA 2: LOG DE AUDITORÍA */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          {/* Barra de filtrado */}
          <div className="bg-paper-2 border border-rule rounded-[--radius-card] p-4 shadow-sm flex flex-col md:flex-row gap-3 md:items-center justify-between">
            <div className="flex-1 flex gap-3">
              <input
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
                placeholder="Buscar por usuario, acción o artículo..."
                className="w-full rounded-xl border border-rule bg-paper px-4 py-2.5 text-sm outline-none focus:border-focus"
              />
              <select
                value={auditActionFilter}
                onChange={e => setAuditActionFilter(e.target.value)}
                className="rounded-xl border border-rule bg-paper px-4 py-2.5 text-sm outline-none font-bold uppercase tracking-wider text-ink-2"
              >
                <option value="todos">Todas las acciones</option>
                <option value="CREATE">Alta (CREATE)</option>
                <option value="UPDATE">Edición (UPDATE)</option>
                <option value="DELETE">Eliminación (DELETE)</option>
                <option value="IMPORT">Importación (IMPORT)</option>
              </select>
            </div>
            <button
              onClick={loadAuditLogs}
              className="px-4 py-2.5 rounded-xl bg-paper-3 text-ink-2 hover:bg-rule font-bold text-xs uppercase tracking-wider transition-all"
            >
              🔄 Actualizar
            </button>
          </div>

          {/* Tabla de Auditoría */}
          <div className="bg-paper-2 border border-rule rounded-[--radius-card] shadow-[--shadow-card] overflow-hidden">
            <div className="px-6 py-4 border-b border-rule flex items-center justify-between">
              <h2 className="text-base font-bold font-display text-accent tracking-wide uppercase">Historial de Auditoría y Cambios</h2>
              <span className="text-xs font-semibold text-ink-3 uppercase">{auditLogs.length} Eventos registrados</span>
            </div>
            {loadingAudit ? (
              <div className="p-8 text-center text-ink-3 font-medium">Cargando registros de auditoría...</div>
            ) : !auditLogs.length ? (
              <EmptyState message="Sin registros de auditoría" sub="No se encontraron eventos con los filtros seleccionados." />
            ) : (
              <div className="overflow-auto scrollbar-hide">
                <table className="min-w-full text-sm">
                  <thead className="bg-paper-3">
                    <tr className="text-left text-ink-3 uppercase tracking-wider text-xs">
                      <th className="px-5 py-3.5 font-bold">Fecha y Hora</th>
                      <th className="px-5 py-3.5 font-bold">Usuario</th>
                      <th className="px-5 py-3.5 font-bold">Acción</th>
                      <th className="px-5 py-3.5 font-bold">Entidad / Módulo</th>
                      <th className="px-5 py-3.5 font-bold">IP</th>
                      <th className="px-5 py-3.5 font-bold text-right">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {auditLogs.map(log => {
                      const actionBadge =
                        log.action === 'CREATE' ? 'bg-state-ok-bg text-state-ok' :
                        log.action === 'UPDATE' ? 'bg-state-info-bg text-state-info' :
                        log.action === 'DELETE' ? 'bg-state-danger-bg text-state-danger' :
                        'bg-paper-3 text-ink-2'
                      return (
                        <tr key={log.id} className="hover:bg-paper-3/50 transition-colors">
                          <td className="px-5 py-3.5 text-ink-2 font-medium text-xs whitespace-nowrap">{formatDate(log.timestamp)}</td>
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-ink text-xs">{log.user_full_name || 'Sistema'}</div>
                            <div className="text-[10px] text-ink-3 font-mono">@{log.username || 'system'}</div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${actionBadge}`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-accent text-xs uppercase tracking-wider">
                            {log.entity_type}
                          </td>
                          <td className="px-5 py-3.5 text-ink-3 font-mono text-xs">{log.ip || '-'}</td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => setSelectedAuditLog(log)}
                              className="px-3 py-1 text-xs font-bold text-accent border border-accent/30 hover:bg-accent-soft rounded-lg transition-all uppercase tracking-wider"
                            >
                              Ver Cambios
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA 3: GESTIÓN DE USUARIOS */}
      {activeTab === 'users' && isAdmin && (
        <div className="space-y-4">
          <div className="bg-paper-2 border border-rule rounded-[--radius-card] p-4 shadow-sm flex flex-col md:flex-row gap-3 md:items-center justify-between">
            <input
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              placeholder="Buscar usuarios por nombre o rol..."
              className="w-full md:max-w-md rounded-xl border border-rule bg-paper px-4 py-2.5 text-sm outline-none focus:border-focus"
            />
            <button
              onClick={() => {
                setUserFormData({ role: 'operador', is_active: true, full_name: '', username: '', email: '' })
                setShowUserForm(true)
              }}
              className="px-5 py-2.5 rounded-xl bg-accent-strong text-accent-ink font-bold tracking-wide uppercase text-sm hover:brightness-110 shadow-md transition-all self-start md:self-auto"
            >
              + Nuevo Usuario
            </button>
          </div>

          <div className="bg-paper-2 border border-rule rounded-[--radius-card] shadow-[--shadow-card] overflow-hidden">
            <div className="px-6 py-4 border-b border-rule flex items-center justify-between">
              <h2 className="text-base font-bold font-display text-accent tracking-wide uppercase">Control de Usuarios del Sistema</h2>
              <span className="text-xs font-semibold text-ink-3 uppercase">{filteredUsers.length} Usuarios</span>
            </div>
            <div className="overflow-auto scrollbar-hide">
              <table className="min-w-full text-sm">
                <thead className="bg-paper-3">
                  <tr className="text-left text-ink-3 uppercase tracking-wider text-xs">
                    <th className="px-5 py-4 font-bold">Usuario</th>
                    <th className="px-5 py-4 font-bold">Nombre Completo</th>
                    <th className="px-5 py-4 font-bold">Rol</th>
                    <th className="px-5 py-4 font-bold">Estado</th>
                    <th className="px-5 py-4 font-bold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule">
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-paper-3/50 transition-colors">
                      <td className="px-5 py-4 font-bold text-accent font-mono text-xs">{u.username}</td>
                      <td className="px-5 py-4 font-semibold text-ink">{u.full_name}</td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-widest uppercase ${
                          u.role === 'admin' ? 'bg-state-danger-bg text-state-danger' :
                          u.role === 'supervisor' ? 'bg-state-warn-bg text-state-warn' :
                          'bg-paper-3 text-ink-2'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {u.is_active ? (
                          <span className="text-state-ok font-bold bg-state-ok-bg px-2.5 py-1 rounded-md text-xs uppercase tracking-wider">Activo</span>
                        ) : (
                          <span className="text-state-danger font-bold bg-state-danger-bg px-2.5 py-1 rounded-md text-xs uppercase tracking-wider">Inactivo</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => {
                            setUserFormData({ ...u, password: '' })
                            setShowUserForm(true)
                          }}
                          className="text-accent font-bold text-xs uppercase tracking-widest border border-accent/30 px-3 py-1.5 rounded-lg hover:bg-accent-soft transition-all"
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
        </div>
      )}

      {/* Modal para Crear / Editar Usuario */}
      {showUserForm && (
        <Modal title={userFormData.id ? "Editar Usuario" : "Nuevo Usuario"} onClose={() => setShowUserForm(false)}>
          <form onSubmit={handleSaveUser} className="space-y-4">
            {userFormError && <div className="text-state-danger text-sm font-bold bg-state-danger-bg p-3 rounded-xl border border-state-danger-bg">{userFormError}</div>}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-ink-3 uppercase tracking-wider mb-2">Usuario (Login)</label>
                <input 
                  autoFocus
                  required
                  className="w-full bg-paper-2 border border-rule rounded-xl px-4 py-2.5 outline-none focus:border-accent font-medium text-ink"
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
                  className="w-full bg-paper-2 border border-rule rounded-xl px-4 py-2.5 outline-none focus:border-accent font-medium text-ink"
                  value={userFormData.password || ''}
                  onChange={e => setUserFormData({...userFormData, password: e.target.value})}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-ink-3 uppercase tracking-wider mb-2">Nombre Completo</label>
                <input 
                  required
                  className="w-full bg-paper-2 border border-rule rounded-xl px-4 py-2.5 outline-none focus:border-accent font-medium text-ink"
                  value={userFormData.full_name || ''}
                  onChange={e => setUserFormData({...userFormData, full_name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-3 uppercase tracking-wider mb-2">Email (Opcional)</label>
                <input 
                  type="email"
                  className="w-full bg-paper-2 border border-rule rounded-xl px-4 py-2.5 outline-none focus:border-accent font-medium text-ink"
                  value={userFormData.email || ''}
                  onChange={e => setUserFormData({...userFormData, email: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-3 uppercase tracking-wider mb-2">Rol</label>
                <select 
                  className="w-full bg-paper-2 border border-rule rounded-xl px-4 py-2.5 outline-none focus:border-accent font-medium text-ink"
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
                  <span className="block text-sm font-bold text-ink">Usuario Activo</span>
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

      {/* Modal para Detalles de Auditoría */}
      {selectedAuditLog && (
        <Modal title={`Detalle de Evento de Auditoría — #${selectedAuditLog.id.slice(0, 8)}`} onClose={() => setSelectedAuditLog(null)} size="md">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 bg-paper-3 p-4 rounded-xl text-xs">
              <div>
                <span className="text-ink-3 uppercase font-bold block">Usuario</span>
                <span className="font-bold text-ink text-sm">{selectedAuditLog.user_full_name || 'Sistema'} (@{selectedAuditLog.username || 'system'})</span>
              </div>
              <div>
                <span className="text-ink-3 uppercase font-bold block">Fecha y Hora</span>
                <span className="font-bold text-ink text-sm">{formatDate(selectedAuditLog.timestamp)}</span>
              </div>
              <div>
                <span className="text-ink-3 uppercase font-bold block">Acción</span>
                <span className="font-bold text-accent text-sm">{selectedAuditLog.action} ({selectedAuditLog.entity_type})</span>
              </div>
              <div>
                <span className="text-ink-3 uppercase font-bold block">Dirección IP</span>
                <span className="font-mono text-ink text-sm">{selectedAuditLog.ip || 'Local / Interno'}</span>
              </div>
            </div>

            {selectedAuditLog.old_values && (
              <div>
                <span className="text-xs font-bold text-state-danger uppercase tracking-wide block mb-1">Valores Anteriores (old_values)</span>
                <pre className="bg-paper-3 border border-rule rounded-xl p-3 text-xs font-mono overflow-auto max-h-48 text-ink">
                  {typeof selectedAuditLog.old_values === 'string'
                    ? selectedAuditLog.old_values
                    : JSON.stringify(selectedAuditLog.old_values, null, 2)}
                </pre>
              </div>
            )}

            {selectedAuditLog.new_values && (
              <div>
                <span className="text-xs font-bold text-state-ok uppercase tracking-wide block mb-1">Valores Nuevos (new_values)</span>
                <pre className="bg-paper-3 border border-rule rounded-xl p-3 text-xs font-mono overflow-auto max-h-48 text-ink">
                  {typeof selectedAuditLog.new_values === 'string'
                    ? selectedAuditLog.new_values
                    : JSON.stringify(selectedAuditLog.new_values, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-3">
              <button
                onClick={() => setSelectedAuditLog(null)}
                className="px-5 py-2 rounded-xl bg-paper border border-rule font-bold text-ink uppercase text-xs hover:bg-paper-3 transition-all"
              >
                Cerrar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
