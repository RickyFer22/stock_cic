import { FormEvent, useMemo, useState } from 'react'
import { setToken } from '../api/client'

export default function LoginPage({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Buen día'
    if (h < 19) return 'Buenas tardes'
    return 'Buenas noches'
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const cleanUsername = username.replace(/,/g, '').trim()
      const cleanPassword = password.trim()
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password: cleanPassword }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
      setToken(json.token)
      onLoggedIn()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
        <section className="lg:col-span-2 relative overflow-hidden rounded-[--radius-card] border border-accent-strong bg-accent-strong shadow-[--shadow-card] text-accent-ink">
          <div className="absolute inset-0">
            <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-accent-strong/20 blur-3xl opacity-60" />
            <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl opacity-60" />
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-accent via-accent to-accent-strong" />
          </div>

          <div className="relative p-6 h-full flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-4">
                <div className="w-14 h-14 rounded-[--radius-card] bg-paper/10 text-accent flex items-center justify-center shadow-lg border border-rule">
                  <span className="text-2xl" aria-hidden="true">🏛</span>
                </div>
                <div>
                  <div className="font-display text-accent-ink font-extrabold tracking-wide uppercase leading-tight text-lg">
                    Municipalidad<br/>de San Roque
                  </div>
                  <div className="text-sm text-accent font-semibold tracking-wide font-body mt-0.5">
                    DIRECCIÓN DE ACCIÓN SOCIAL
                  </div>
                </div>
              </div>

              <h2 className="mt-8 font-display font-black text-4xl text-accent-ink tracking-tight">
                {greeting}
              </h2>
              <p className="mt-3 text-ink-3 text-sm leading-relaxed max-w-sm">
                Accedé al Sistema de Gestión de Stock para registrar ingresos, distribuciones, cierres e importación por Excel.
              </p>

              <div className="mt-8 grid grid-cols-2 gap-3">
                <div className="rounded-[--radius-card] border border-paper/10 bg-paper/5 backdrop-blur-sm px-5 py-4">
                  <div className="text-[0.65rem] text-accent font-bold uppercase tracking-wider mb-1">Módulo</div>
                  <div className="font-semibold text-accent-ink tracking-wide">Stock</div>
                </div>
                <div className="rounded-[--radius-card] border border-paper/10 bg-paper/5 backdrop-blur-sm px-5 py-4">
                  <div className="text-[0.65rem] text-accent font-bold uppercase tracking-wider mb-1">Área</div>
                  <div className="font-semibold text-accent-ink tracking-wide">Acción Social</div>
                </div>
              </div>
            </div>

            <div className="mt-8 text-xs text-ink-3">
              <div className="font-bold text-ink-3 uppercase tracking-wider">Soporte</div>
              <div className="mt-1.5 leading-relaxed">Si no podés ingresar, contactá al área de Sistemas o solicitá reseteo de contraseña.</div>
            </div>
          </div>
        </section>

        <section className="lg:col-span-3 relative overflow-hidden rounded-[--radius-card] border border-white/40 bg-paper-2 backdrop-blur-xl shadow-[--shadow-card]">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-accent-strong" />

          <div className="p-8 sm:p-10 flex flex-col h-full justify-center">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <h1 className="font-display font-extrabold text-ink text-3xl uppercase tracking-wider">
                  Ingreso
                </h1>
                <p className="text-ink-3 mt-1.5 text-sm font-medium">
                  Sistema de Gestión de Stock
                </p>
              </div>
              <div className="hidden sm:block text-xs text-ink-3 text-right">
                <div className="font-bold text-accent tracking-wider uppercase">San Roque</div>
                <div className="mt-0.5">Corrientes, Argentina</div>
              </div>
            </div>

            <form onSubmit={submit} className="mt-8 space-y-5">
              <label className="block">
                <span className="text-sm text-ink-2 font-bold tracking-wide uppercase">Usuario</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1.5 w-full rounded-[--radius-card] border-2 border-rule bg-paper/50 px-5 py-3.5 focus:outline-none focus:border-focus focus:ring-0 transition-colors shadow-sm"
                  autoComplete="username"
                  inputMode="text"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm text-ink-2 font-bold tracking-wide uppercase">Contraseña</span>
                <div className="mt-1.5 relative">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-[--radius-card] border-2 border-rule bg-paper/50 px-5 py-3.5 pr-24 focus:outline-none focus:border-focus focus:ring-0 transition-colors shadow-sm"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl text-xs font-bold text-ink-3 bg-paper-3 hover:bg-rule hover:text-ink transition uppercase tracking-wider"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
              </label>

              {error && (
                <div className="rounded-[--radius-card] border border-state-warn/25 bg-state-warn-bg px-4 py-3 text-sm text-state-warn">
                  <div className="font-semibold">No se pudo ingresar</div>
                  <div className="mt-1">{error}</div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full px-5 py-4 mt-2 rounded-[--radius-card] bg-accent-strong text-accent-ink font-bold tracking-wide uppercase hover:brightness-110 hover:shadow-lg transition-all disabled:opacity-70 disabled:hover:shadow-none"
              >
                {loading ? 'Ingresando...' : 'Ingresar al Sistema'}
              </button>

              <div className="pt-5 border-t border-rule/60 mt-6 text-xs text-ink-3 leading-relaxed text-center">
                Si no recordás tu acceso, solicitá restablecimiento al administrador del sistema.
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  )
}
