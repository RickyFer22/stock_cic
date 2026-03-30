import { useEffect, useMemo, useState } from 'react'
import EmptyState from './components/EmptyState'
import { apiGet, setToken } from './api/client'
import DistributionsPage from './pages/DistributionsPage'
import LoginPage from './pages/LoginPage'
import ItemsPage from './pages/ItemsPage'
import MovementsPage from './pages/MovementsPage'
import SupervisorPage from './pages/SupervisorPage'

type MeResponse = { user?: { full_name: string; role: string } }

function Shell({ children, userName, onLogout }: { children: any; userName: string | null; onLogout: () => void }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/20 glass shadow-sm">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-green-900 text-white flex items-center justify-center shadow-md">
              <span className="text-xl" aria-hidden="true">🏛</span>
            </div>
            <div>
              <div className="font-display text-brand-green-900 font-black tracking-wide uppercase leading-tight text-lg">
                Stock <span className="text-brand-gold-500">MSR</span>
              </div>
              <div className="text-xs text-slate-500 font-bold tracking-wider uppercase">
                Acción Social
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {userName && (
              <>
                <span className="hidden sm:inline text-sm text-slate-600 font-medium">Operador: <b className="text-slate-900">{userName}</b></span>
                <button
                  onClick={onLogout}
                  className="px-4 py-2 rounded-xl text-xs font-bold tracking-wider uppercase bg-slate-900 text-white hover:bg-slate-800 transition shadow-sm hover:shadow-md"
                >
                  Salir
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {children}
      </main>
    </div>
  )
}

export default function App() {
  const [me, setMe] = useState<MeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [tab, setTab] = useState<'distributions' | 'items' | 'movements' | 'supervisor'>('distributions')

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (['distributions', 'items', 'movements', 'supervisor'].includes(hash)) {
      setTab(hash as any)
    }

    let cancelled = false
    apiGet<MeResponse>('/api/auth/me')
      .then((data) => { if (!cancelled) setMe(data) })
      .catch((e) => { if (!cancelled) setError(e.message || 'No autenticado') })
    return () => { cancelled = true }
  }, [refreshKey])

  useEffect(() => {
    window.location.hash = tab
  }, [tab])

  const userName = useMemo(() => me?.user?.full_name || null, [me])

  if (error) {
    return (
      <Shell userName={null} onLogout={() => { setToken(null); location.reload() }}>
        <LoginPage onLoggedIn={() => { setError(null); setMe(null); setRefreshKey((k) => k + 1) }} />
      </Shell>
    )
  }

  if (!me) return <EmptyState message="Cargando" sub="Verificando sesión..." icon="⏳" />

  return (
    <Shell userName={userName} onLogout={() => { setToken(null); location.reload() }}>
      <div className="mb-6 flex overflow-x-auto pb-2 gap-3 snap-x scrollbar-hide">
        <button
          onClick={() => setTab('distributions')}
          className={`flex-shrink-0 px-5 py-2.5 rounded-xl font-bold tracking-wide uppercase text-sm border-2 transition-all ${
            tab === 'distributions'
              ? 'bg-brand-green-900 text-white border-brand-green-900 shadow-md'
              : 'bg-white text-slate-600 border-slate-200 hover:border-brand-green-500/30 hover:bg-slate-50'
          }`}
        >
          Egresos
        </button>
        <button
          onClick={() => setTab('items')}
          className={`flex-shrink-0 px-5 py-2.5 rounded-xl font-bold tracking-wide uppercase text-sm border-2 transition-all ${
            tab === 'items'
              ? 'bg-brand-green-900 text-white border-brand-green-900 shadow-md'
              : 'bg-white text-slate-600 border-slate-200 hover:border-brand-green-500/30 hover:bg-slate-50'
          }`}
        >
          Artículos
        </button>
        <button
          onClick={() => setTab('movements')}
          className={`flex-shrink-0 px-5 py-2.5 rounded-xl font-bold tracking-wide uppercase text-sm border-2 transition-all ${
            tab === 'movements'
              ? 'bg-brand-green-900 text-white border-brand-green-900 shadow-md'
              : 'bg-white text-slate-600 border-slate-200 hover:border-brand-green-500/30 hover:bg-slate-50'
          }`}
        >
          Movimientos
        </button>
        {me?.user?.role === 'admin' && (
          <button
            onClick={() => setTab('supervisor')}
            className={`flex-shrink-0 px-5 py-2.5 rounded-xl font-bold tracking-wide uppercase text-sm border-2 transition-all ${
              tab === 'supervisor'
                ? 'bg-amber-600 text-white border-amber-600 shadow-md'
                : 'bg-white text-amber-700 border-amber-200 hover:border-amber-500 hover:bg-amber-50'
            }`}
          >
            Supervisor
          </button>
        )}
      </div>

      {tab === 'distributions' && <DistributionsPage />}
      {tab === 'items' && <ItemsPage />}
      {tab === 'movements' && <MovementsPage />}
      {tab === 'supervisor' && me?.user?.role === 'admin' && <SupervisorPage />}
    </Shell>
  )
}
