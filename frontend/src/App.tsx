import { useEffect, useMemo, useState } from 'react'
import EmptyState from './components/EmptyState'
import ThemeToggle from './components/ThemeToggle'
import HelpPanel from './components/HelpPanel'
import { apiGet, setToken } from './api/client'
import DistributionsPage from './pages/DistributionsPage'
import LoginPage from './pages/LoginPage'
import ItemsPage from './pages/ItemsPage'
import MovementsPage from './pages/MovementsPage'
import SupervisorPage from './pages/SupervisorPage'
import SoportePage from './pages/SoportePage'

type Role = 'admin' | 'supervisor' | 'operador'
type Tab = 'egresos' | 'articulos' | 'movimientos' | 'supervisor' | 'soporte'
type MeResponse = { user?: { full_name: string; role: Role } }

type ShellProps = {
  children: any
  userName: string | null
  tab: Tab
  setTab: (t: Tab) => void
  canOpenSupervisor: boolean
  onLogout: () => void
  onHelp: () => void
  showHelpButton: boolean
}

type NavItem = { k: Tab; l: string; icono: string; ayuda: string; tono?: 'amber' }

const HASH_MAP: Record<string, Tab> = {
  egresos: 'egresos',
  distributions: 'egresos',
  articulos: 'articulos',
  items: 'articulos',
  movimientos: 'movimientos',
  movements: 'movimientos',
  supervisor: 'supervisor',
  soporte: 'soporte',
}

const GRUPOS: { titulo: string; items: NavItem[] }[] = [
  {
    titulo: 'Operación',
    items: [
      { k: 'egresos', l: 'Egresos', icono: '📦', ayuda: 'Registrar y consultar la mercadería que sale del depósito' },
      { k: 'articulos', l: 'Artículos', icono: '📋', ayuda: 'Alta, edición y stock disponible de cada artículo' },
      { k: 'movimientos', l: 'Movimientos', icono: '📊', ayuda: 'Historial completo de ingresos y egresos' },
    ],
  },
  {
    titulo: 'Administración',
    items: [
      { k: 'supervisor', l: 'Supervisor', icono: '🛡️', ayuda: 'Métricas del depósito, log de auditoría y gestión de usuarios', tono: 'amber' },
    ],
  },
  {
    titulo: 'Ayuda',
    items: [
      { k: 'soporte', l: 'Soporte', icono: '💬', ayuda: 'Abrir una consulta al equipo de sistemas y seguir su estado' },
    ],
  },
]

function Shell({ children, userName, tab, setTab, canOpenSupervisor, onLogout, onHelp, showHelpButton }: ShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // If user is not logged in (LoginPage view)
  if (!userName) {
    return (
      <div className="min-h-screen bg-paper flex flex-col justify-between p-4 sm:p-8">
        <main className="mx-auto w-full max-w-5xl my-auto">{children}</main>
        <footer className="mt-8 border-t border-rule pt-4 text-center text-xs text-ink-3">
          <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="font-semibold text-ink-2">
              Dirección de Modernización: <span className="font-bold text-accent">Ricardo Fernández</span>
            </div>
            <div className="font-medium text-ink-3">
              Intendente Cr. Raúl Pelozo — <span className="font-semibold text-ink-2">Gestión 2025-2029</span>
            </div>
          </div>
        </footer>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col md:flex-row">
      {/* BARRA SUPERIOR MOBILE */}
      <header className="md:hidden sticky top-0 z-40 border-b border-rule bg-paper-2 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent-strong text-accent-ink flex items-center justify-center font-bold">
            🏛
          </div>
          <div>
            <div className="font-display font-extrabold text-ink text-sm uppercase leading-none">
              Stock <span className="text-accent">MSR</span>
            </div>
            <div className="text-[10px] text-ink-3 font-bold uppercase mt-0.5">Acción Social</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg border border-rule bg-paper text-ink font-bold text-sm uppercase"
            aria-label="Abrir menú"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </header>

      {/* MENÚ LATERAL IZQUIERDO (DESKTOP + MOBILE DRAWER) */}
      <aside className={`
        fixed md:sticky top-0 inset-y-0 left-0 z-50 w-64 md:w-72 bg-paper-2 border-r border-rule flex flex-col justify-between transition-transform duration-200 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-5 flex flex-col gap-6 overflow-y-auto">
          {/* Logo Marca Municipal */}
          <div className="flex items-center gap-3 pb-4 border-b border-rule">
            <div className="w-11 h-11 rounded-xl bg-accent-strong text-white shadow-md flex items-center justify-center shrink-0">
              <span className="text-xl">🏛</span>
            </div>
            <div>
              <div className="font-display text-ink font-extrabold tracking-wide uppercase leading-tight text-base">
                Stock <span className="text-accent">MSR</span>
              </div>
              <div className="text-xs text-ink-3 font-bold tracking-wide uppercase mt-0.5">Acción Social</div>
            </div>
          </div>

          {/* Menú por Grupos */}
          <nav className="space-y-6">
            {GRUPOS.map((grupo) => {
              const visibles = grupo.items.filter((i) => i.k !== 'supervisor' || canOpenSupervisor)
              if (!visibles.length) return null
              return (
                <div key={grupo.titulo} className="space-y-2">
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-ink-3 px-2 select-none">
                    {grupo.titulo}
                  </div>
                  <div className="space-y-1">
                    {visibles.map((item) => {
                      const active = tab === item.k
                      const amber = item.tono === 'amber'
                      
                      const activeStyle = amber
                        ? 'bg-amber-600 text-white font-bold shadow-md'
                        : 'bg-accent-strong text-white font-bold shadow-md'
                      const idleStyle = amber
                        ? 'text-amber-700 hover:bg-amber-50 hover:text-amber-800'
                        : 'text-ink-2 hover:bg-accent-soft hover:text-accent font-semibold'

                      return (
                        <button
                          key={item.k}
                          onClick={() => {
                            setTab(item.k)
                            setMobileMenuOpen(false)
                          }}
                          className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-between group ${
                            active ? activeStyle : idleStyle
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-base">{item.icono}</span>
                            <span>{item.l}</span>
                          </div>
                          {active && <span className="text-xs">›</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </nav>
        </div>

        {/* Footer del Menú Lateral */}
        <div className="p-4 border-t border-rule bg-paper-3/40 space-y-3 shrink-0">
          {userName && (
            <div className="bg-paper p-3 rounded-xl border border-rule">
              <div className="text-[10px] text-ink-3 uppercase font-bold tracking-wider">Operador Activo</div>
              <div className="text-xs font-bold text-ink truncate mt-0.5">{userName}</div>
            </div>
          )}

          {/* Selector de Tema Visual */}
          <div className="space-y-1">
            <div className="text-[10px] text-ink-3 uppercase font-bold tracking-wider px-0.5">Tema Visual</div>
            <div className="flex justify-center">
              <ThemeToggle />
            </div>
          </div>

          {/* Acciones de Sistema */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-rule/50">
            {showHelpButton && (
              <button
                onClick={onHelp}
                className="py-2 px-2.5 rounded-xl border border-rule bg-paper text-ink-2 text-xs font-bold uppercase hover:bg-paper-3 hover:text-ink transition flex items-center justify-center gap-1.5"
              >
                <span>❓</span>
                <span>Ayuda</span>
              </button>
            )}
            <button
              onClick={onLogout}
              className="py-2 px-2.5 rounded-xl border border-state-danger/30 bg-state-danger-bg text-state-danger text-xs font-bold uppercase hover:bg-state-danger hover:text-white transition flex items-center justify-center gap-1.5"
              title="Cerrar sesión"
            >
              <span>🚪</span>
              <span>Salir</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ÁREA DE CONTENIDO PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">{children}</main>

        <footer className="border-t border-rule bg-paper-2 py-4 px-6 text-xs text-ink-3 mt-auto">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="font-semibold text-ink-2">
              Dirección de Modernización: <span className="font-bold text-accent">Ricardo Fernández</span>
            </div>
            <div className="font-medium text-ink-3">
              Intendente Cr. Raúl Pelozo — <span className="font-semibold text-ink-2">Gestión 2025-2029</span>
            </div>
          </div>
        </footer>
      </div>

      {/* OVERLAY PARA MOBILE MENU */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-40 md:hidden"
        />
      )}
    </div>
  )
}

export default function App() {
  const [me, setMe] = useState<MeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [tab, setTab] = useState<Tab>('egresos')
  const [helpOpen, setHelpOpen] = useState(false)

  const role = me?.user?.role ?? null
  const canOpenSupervisor = role === 'admin' || role === 'supervisor'

  const availableTabs = useMemo<Tab[]>(
    () => (canOpenSupervisor ? ['egresos', 'articulos', 'movimientos', 'supervisor', 'soporte'] : ['egresos', 'articulos', 'movimientos', 'soporte']),
    [canOpenSupervisor],
  )

  useEffect(() => {
    const aplicarHash = () => {
      const rawHash = window.location.hash.replace('#', '')
      const mappedTab = HASH_MAP[rawHash]
      if (mappedTab && availableTabs.includes(mappedTab)) {
        setTab(mappedTab)
      } else if (rawHash === 'supervisor' && !canOpenSupervisor) {
        setTab('egresos')
      }
    }
    aplicarHash()
    window.addEventListener('hashchange', aplicarHash)
    return () => window.removeEventListener('hashchange', aplicarHash)
  }, [availableTabs, canOpenSupervisor])

  useEffect(() => {
    let cancelled = false
    apiGet<MeResponse>('/api/auth/me')
      .then((data) => {
        if (!cancelled) setMe(data)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'No autenticado')
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  useEffect(() => {
    window.location.hash = tab
  }, [tab])

  useEffect(() => {
    if (!canOpenSupervisor && tab === 'supervisor') {
      setTab('egresos')
    }
  }, [canOpenSupervisor, tab])

  const userName = useMemo(() => me?.user?.full_name || null, [me])

  if (error) {
    return (
      <Shell
        userName={null}
        tab={tab}
        setTab={setTab}
        canOpenSupervisor={false}
        onLogout={() => { setToken(null); location.reload() }}
        onHelp={() => {}}
        showHelpButton={false}
      >
        <LoginPage onLoggedIn={() => { setError(null); setMe(null); setRefreshKey((k) => k + 1) }} />
      </Shell>
    )
  }

  if (!me) return <EmptyState message="Cargando" sub="Verificando sesión..." icon="⏳" />

  return (
    <Shell
      userName={userName}
      tab={tab}
      setTab={setTab}
      canOpenSupervisor={canOpenSupervisor}
      onLogout={() => { setToken(null); location.reload() }}
      onHelp={() => setHelpOpen(true)}
      showHelpButton
    >
      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} currentTab={tab} showSupervisorHelp={canOpenSupervisor} />

      {tab === 'egresos' && <DistributionsPage />}
      {tab === 'articulos' && <ItemsPage role={role} />}
      {tab === 'movimientos' && <MovementsPage />}
      {tab === 'soporte' && <SoportePage role={role} />}
      {tab === 'supervisor' && canOpenSupervisor && <SupervisorPage role={role as 'admin' | 'supervisor'} />}
    </Shell>
  )
}
