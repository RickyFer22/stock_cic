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
  onLogout: () => void
  onHelp: () => void
  showHelpButton: boolean
}

type NavItem = { k: Tab; l: string; ayuda: string; tono?: 'amber' }

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
      { k: 'egresos', l: 'Egresos', ayuda: 'Registrar y consultar la mercadería que sale del depósito' },
      { k: 'articulos', l: 'Artículos', ayuda: 'Alta, edición y stock disponible de cada artículo' },
      { k: 'movimientos', l: 'Movimientos', ayuda: 'Historial completo de ingresos y egresos' },
    ],
  },
  {
    titulo: 'Administración',
    items: [
      { k: 'supervisor', l: 'Supervisor', ayuda: 'Métricas del depósito, log de auditoría y gestión de usuarios', tono: 'amber' },
    ],
  },
  {
    titulo: 'Ayuda',
    items: [
      { k: 'soporte', l: 'Soporte', ayuda: 'Abrir una consulta al equipo de sistemas y seguir su estado' },
    ],
  },
]

function NavButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const amber = item.tono === 'amber'
  const activeClass = amber
    ? 'bg-state-warn text-accent-ink border-state-warn'
    : 'bg-accent-strong text-accent-ink border-accent-strong'
  const idleClass = amber
    ? 'bg-paper text-state-warn border-state-warn/40 hover:border-state-warn hover:bg-state-warn-bg'
    : 'bg-paper text-ink-2 border-rule hover:text-ink hover:border-accent hover:bg-accent-soft'

  return (
    <button
      onClick={onClick}
      data-tip={item.ayuda}
      aria-current={active ? 'page' : undefined}
      className={`min-h-[2.75rem] px-4 py-2.5 rounded-[--radius-input] border
        font-bold tracking-wide uppercase text-[length:--text-xs] sm:text-[length:--text-sm]
        transition-colors duration-[--dur-fast] ease-[--ease-out]
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus
        ${active ? activeClass : idleClass}`}
    >
      {item.l}
    </button>
  )
}

function Shell({ children, userName, onLogout, onHelp, showHelpButton }: ShellProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-rule bg-paper-2">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-[--radius-input] bg-accent-strong text-accent-ink flex items-center justify-center shrink-0">
              <span className="text-lg" aria-hidden="true">🏛</span>
            </div>
            <div className="min-w-0">
              <div className="font-display text-ink font-extrabold tracking-wide uppercase leading-tight text-[length:--text-md] truncate">
                Stock <span className="text-accent">MSR</span>
              </div>
              <div className="text-[length:--text-xs] text-ink-3 font-bold tracking-wide uppercase truncate">Acción Social</div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {userName && (
              <span className="hidden lg:inline text-[length:--text-sm] text-ink-2">
                Operador: <b className="text-ink">{userName}</b>
              </span>
            )}

            <ThemeToggle />

            {showHelpButton && (
              <button
                onClick={onHelp}
                data-tip="Guía de uso de la pantalla en la que estás"
                className="min-h-[2.75rem] px-3 py-2 rounded-[--radius-input] border border-rule bg-paper
                  text-[length:--text-xs] font-bold tracking-wide uppercase text-ink-2
                  hover:text-ink hover:border-rule-strong transition-colors duration-[--dur-fast]
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                Ayuda
              </button>
            )}

            {userName && (
              <button
                onClick={onLogout}
                data-tip="Cerrar la sesión y volver al inicio"
                className="min-h-[2.75rem] px-4 py-2 rounded-[--radius-input] border border-rule bg-paper
                  text-[length:--text-xs] font-bold tracking-wide uppercase text-ink-2
                  hover:text-ink hover:border-rule-strong transition-colors duration-[--dur-fast]
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                Salir
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-28 md:pb-8 flex-1">{children}</main>

      <footer className="border-t border-rule bg-paper-2 py-4 text-xs text-ink-3">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
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
      <Shell userName={null} onLogout={() => { setToken(null); location.reload() }} onHelp={() => {}} showHelpButton={false}>
        <LoginPage onLoggedIn={() => { setError(null); setMe(null); setRefreshKey((k) => k + 1) }} />
      </Shell>
    )
  }

  if (!me) return <EmptyState message="Cargando" sub="Verificando sesión..." icon="⏳" />

  return (
    <Shell
      userName={userName}
      onLogout={() => { setToken(null); location.reload() }}
      onHelp={() => setHelpOpen(true)}
      showHelpButton
    >
      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} currentTab={tab} showSupervisorHelp={canOpenSupervisor} />

      <nav aria-label="Navegación principal" className="hidden md:flex mb-6 flex-wrap items-start gap-x-8 gap-y-4">
        {GRUPOS.map((grupo) => {
          const visibles = grupo.items.filter((i) => i.k !== 'supervisor' || canOpenSupervisor)
          if (!visibles.length) return null
          return (
            <div key={grupo.titulo} className="flex flex-col gap-2">
              <span
                className="text-[10px] font-black uppercase tracking-[0.18em] text-ink-3 pl-1 select-none"
                aria-hidden="true"
              >
                {grupo.titulo}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {visibles.map((item) => (
                  <NavButton
                    key={item.k}
                    item={item}
                    active={tab === item.k}
                    onClick={() => setTab(item.k)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      {tab === 'egresos' && <DistributionsPage />}
      {tab === 'articulos' && <ItemsPage role={role} />}
      {tab === 'movimientos' && <MovementsPage />}
      {tab === 'soporte' && <SoportePage role={role} />}
      {tab === 'supervisor' && canOpenSupervisor && <SupervisorPage role={role as 'admin' | 'supervisor'} />}

      <nav
        aria-label="Navegación principal"
        className="fixed md:hidden bottom-0 inset-x-0 z-40 border-t border-rule bg-paper/95 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
      >
        <div className={`grid gap-1.5 ${canOpenSupervisor ? 'grid-cols-5' : 'grid-cols-4'}`}>
          {([
            ['egresos', 'Egresos'],
            ['articulos', 'Artículos'],
            ['movimientos', 'Movim.'],
            ['soporte', 'Soporte'],
            ...(canOpenSupervisor ? [['supervisor', 'Superv.'] as [Tab, string]] : []),
          ] as [Tab, string][]).map(([key, label]) => {
            const active = tab === key
            const amber = key === 'supervisor'
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                aria-current={active ? 'page' : undefined}
                className={`rounded-xl px-1 py-2 text-[10.5px] font-bold uppercase tracking-wide truncate ${
                  active
                    ? amber ? 'bg-state-warn text-accent-ink' : 'bg-accent-strong text-accent-ink'
                    : amber ? 'bg-state-warn-bg text-state-warn' : 'bg-paper-3 text-ink-2'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </nav>
    </Shell>
  )
}
