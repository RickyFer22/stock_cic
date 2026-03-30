import { useEffect, useMemo, useState } from 'react'
import EmptyState from './components/EmptyState'
import HelpPanel from './components/HelpPanel'
import { apiGet, setToken } from './api/client'
import DistributionsPage from './pages/DistributionsPage'
import LoginPage from './pages/LoginPage'
import ItemsPage from './pages/ItemsPage'
import MovementsPage from './pages/MovementsPage'
import SupervisorPage from './pages/SupervisorPage'

type Role = 'admin' | 'supervisor' | 'operador'
type Tab = 'distributions' | 'items' | 'movements' | 'supervisor'
type MeResponse = { user?: { full_name: string; role: Role } }

type ShellProps = {
  children: any
  userName: string | null
  onLogout: () => void
  onHelp: () => void
  showHelpButton: boolean
}

type NavButtonProps = {
  label: string
  active: boolean
  tone?: 'green' | 'amber'
  onClick: () => void
}

function NavButton({ label, active, tone = 'green', onClick }: NavButtonProps) {
  const activeClass =
    tone === 'amber'
      ? 'bg-amber-600 text-white border-amber-600 shadow-md'
      : 'bg-brand-green-900 text-white border-brand-green-900 shadow-md'

  const idleClass =
    tone === 'amber'
      ? 'bg-white text-amber-700 border-amber-200 hover:border-amber-500 hover:bg-amber-50'
      : 'bg-white text-slate-600 border-slate-200 hover:border-brand-green-500/30 hover:bg-slate-50'

  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 rounded-xl font-bold tracking-wide uppercase text-xs sm:text-sm border-2 transition-all ${active ? activeClass : idleClass}`}
    >
      {label}
    </button>
  )
}

function Shell({ children, userName, onLogout, onHelp, showHelpButton }: ShellProps) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/20 glass shadow-sm">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-brand-green-900 text-white flex items-center justify-center shadow-md">
              <span className="text-xl" aria-hidden="true">🏛</span>
            </div>
            <div className="min-w-0">
              <div className="font-display text-brand-green-900 font-black tracking-wide uppercase leading-tight text-lg truncate">
                Stock <span className="text-brand-gold-500">MSR</span>
              </div>
              <div className="text-xs text-slate-500 font-bold tracking-wider uppercase truncate">Accion Social</div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {userName && (
              <span className="hidden lg:inline text-sm text-slate-600 font-medium">
                Operador: <b className="text-slate-900">{userName}</b>
              </span>
            )}

            {showHelpButton && (
              <button
                onClick={onHelp}
                className="px-3 py-2 rounded-xl text-xs font-bold tracking-wider uppercase bg-brand-gold-500 text-brand-green-900 hover:brightness-110 transition shadow-sm"
              >
                Ayuda
              </button>
            )}

            {userName && (
              <button
                onClick={onLogout}
                className="px-4 py-2 rounded-xl text-xs font-bold tracking-wider uppercase bg-slate-900 text-white hover:bg-slate-800 transition shadow-sm hover:shadow-md"
              >
                Salir
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-28 md:pb-8">{children}</main>
    </div>
  )
}

export default function App() {
  const [me, setMe] = useState<MeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [tab, setTab] = useState<Tab>('distributions')
  const [helpOpen, setHelpOpen] = useState(false)

  const role = me?.user?.role ?? null
  const canOpenSupervisor = role === 'admin' || role === 'supervisor'

  const availableTabs = useMemo<Tab[]>(
    () => (canOpenSupervisor ? ['distributions', 'items', 'movements', 'supervisor'] : ['distributions', 'items', 'movements']),
    [canOpenSupervisor],
  )

  useEffect(() => {
    const hash = window.location.hash.replace('#', '') as Tab
    if (availableTabs.includes(hash)) {
      setTab(hash)
    } else if (hash === 'supervisor' && !canOpenSupervisor) {
      setTab('distributions')
    }
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
      setTab('distributions')
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

  if (!me) return <EmptyState message="Cargando" sub="Verificando sesion..." icon="⏳" />

  return (
    <Shell
      userName={userName}
      onLogout={() => { setToken(null); location.reload() }}
      onHelp={() => setHelpOpen(true)}
      showHelpButton
    >
      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} currentTab={tab} showSupervisorHelp={canOpenSupervisor} />

      <div className="md:hidden mb-4">
        <div className="grid grid-cols-2 gap-2">
          <NavButton label="Egresos" active={tab === 'distributions'} onClick={() => setTab('distributions')} />
          <NavButton label="Articulos" active={tab === 'items'} onClick={() => setTab('items')} />
          <NavButton label="Movimientos" active={tab === 'movements'} onClick={() => setTab('movements')} />
          {canOpenSupervisor && (
            <NavButton label="Supervisor" active={tab === 'supervisor'} tone="amber" onClick={() => setTab('supervisor')} />
          )}
        </div>
      </div>

      <div className="hidden md:flex mb-6 flex-wrap gap-3">
        <NavButton label="Egresos" active={tab === 'distributions'} onClick={() => setTab('distributions')} />
        <NavButton label="Articulos" active={tab === 'items'} onClick={() => setTab('items')} />
        <NavButton label="Movimientos" active={tab === 'movements'} onClick={() => setTab('movements')} />
        {canOpenSupervisor && (
          <NavButton label="Supervisor" active={tab === 'supervisor'} tone="amber" onClick={() => setTab('supervisor')} />
        )}
      </div>

      {tab === 'distributions' && <DistributionsPage />}
      {tab === 'items' && <ItemsPage />}
      {tab === 'movements' && <MovementsPage />}
      {tab === 'supervisor' && canOpenSupervisor && <SupervisorPage role={role as 'admin' | 'supervisor'} />}

      <nav className="fixed md:hidden bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <div className={`grid gap-2 ${canOpenSupervisor ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <button
            onClick={() => setTab('distributions')}
            className={`rounded-xl px-2 py-2 text-[11px] font-bold uppercase tracking-wide ${tab === 'distributions' ? 'bg-brand-green-900 text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            Egresos
          </button>
          <button
            onClick={() => setTab('items')}
            className={`rounded-xl px-2 py-2 text-[11px] font-bold uppercase tracking-wide ${tab === 'items' ? 'bg-brand-green-900 text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            Articulos
          </button>
          <button
            onClick={() => setTab('movements')}
            className={`rounded-xl px-2 py-2 text-[11px] font-bold uppercase tracking-wide ${tab === 'movements' ? 'bg-brand-green-900 text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            Movimientos
          </button>
          {canOpenSupervisor && (
            <button
              onClick={() => setTab('supervisor')}
              className={`rounded-xl px-2 py-2 text-[11px] font-bold uppercase tracking-wide ${tab === 'supervisor' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700'}`}
            >
              Supervisor
            </button>
          )}
        </div>
      </nav>
    </Shell>
  )
}
