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
type Tab = 'distributions' | 'items' | 'movements' | 'supervisor' | 'soporte'
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
  // El estado activo se marca con relleno de acento Y aria-current: el color no
  // comunica solo. El tono ámbar distingue Supervisor sin salir de la escala
  // semántica de "atención".
  const activeClass =
    tone === 'amber'
      ? 'bg-state-warn text-paper border-state-warn'
      : 'bg-accent-strong text-accent-ink border-accent-strong'

  const idleClass =
    tone === 'amber'
      ? 'bg-paper text-state-warn border-rule hover:border-state-warn'
      : 'bg-paper text-ink-2 border-rule hover:text-ink hover:border-rule-strong'

  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`min-h-[2.75rem] px-4 py-2.5 rounded-[--radius-input] border
        font-bold tracking-wide uppercase text-[length:--text-xs] sm:text-[length:--text-sm]
        transition-colors duration-[--dur-fast] ease-[--ease-out]
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus
        ${active ? activeClass : idleClass}`}
    >
      {label}
    </button>
  )
}

function Shell({ children, userName, onLogout, onHelp, showHelpButton }: ShellProps) {
  return (
    <div className="min-h-screen">
      {/* Sin glassmorphism: el género modern-minimal lo excluye, y sobre una
          tabla densa el desenfoque solo agrega ruido. Papel sólido y una regla. */}
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
    () => (canOpenSupervisor ? ['distributions', 'items', 'movements', 'supervisor', 'soporte'] : ['distributions', 'items', 'movements', 'soporte']),
    [canOpenSupervisor],
  )

  // Sincroniza el hash con la pestaña activa, en los dos sentidos. Sin el listener
  // de hashchange el boton Atras cambiaba la URL pero la vista se quedaba igual.
  useEffect(() => {
    const aplicarHash = () => {
      const hash = window.location.hash.replace('#', '') as Tab
      if (availableTabs.includes(hash)) {
        setTab(hash)
      } else if (hash === 'supervisor' && !canOpenSupervisor) {
        setTab('distributions')
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

      {/* En movil la navegacion vive solo en la barra inferior fija: la grilla que
          habia aca arriba mostraba las mismas pestanas dos veces en pantalla. */}
      {/* Navegacion agrupada por uso: lo que se toca varias veces por dia queda
          separado de lo administrativo y de las utilidades transversales. Antes
          eran cinco pestañas planas en orden historico, sin jerarquia. */}
      <nav aria-label="Navegación principal" className="hidden md:flex mb-6 flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-ink-3 mr-1">Operación</span>
        <NavButton label="Egresos" active={tab === 'distributions'} onClick={() => setTab('distributions')} />
        <NavButton label="Articulos" active={tab === 'items'} onClick={() => setTab('items')} />
        <NavButton label="Movimientos" active={tab === 'movements'} onClick={() => setTab('movements')} />

        {canOpenSupervisor && (
          <>
            <span className="w-px h-7 bg-rule mx-1" aria-hidden="true" />
            <span className="text-[10px] font-black uppercase tracking-widest text-ink-3 mr-1">Administración</span>
            <NavButton label="Supervisor" active={tab === 'supervisor'} tone="amber" onClick={() => setTab('supervisor')} />
          </>
        )}

        <span className="w-px h-7 bg-rule mx-1" aria-hidden="true" />
        <span className="text-[10px] font-black uppercase tracking-widest text-ink-3 mr-1">Ayuda</span>
        <NavButton label="Soporte" active={tab === 'soporte'} onClick={() => setTab('soporte')} />
      </nav>

      {tab === 'distributions' && <DistributionsPage />}
      {tab === 'items' && <ItemsPage role={role} />}
      {tab === 'movements' && <MovementsPage />}
      {tab === 'soporte' && <SoportePage role={role} />}
      {tab === 'supervisor' && canOpenSupervisor && <SupervisorPage role={role as 'admin' | 'supervisor'} />}

      <nav
        aria-label="Navegación principal"
        className="fixed md:hidden bottom-0 inset-x-0 z-40 border-t border-rule bg-paper/95 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
      >
        <div className={`grid gap-1.5 ${canOpenSupervisor ? 'grid-cols-5' : 'grid-cols-4'}`}>
          {([
            ['distributions', 'Egresos'],
            ['items', 'Articulos'],
            ['movements', 'Movim.'],
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
                    ? amber ? 'bg-state-warn text-white' : 'bg-accent-strong text-white'
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
