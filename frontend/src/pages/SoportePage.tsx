import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost, apiPut } from '../api/client'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import Banner, { type Feedback } from '../components/Banner'
import ConfirmDialog from '../components/ConfirmDialog'
import { Badge, Button, Card, Label, PageHeader, Pager } from '../components/ui'
import { formatFecha } from '../lib/format'

/**
 * Bandeja de soporte. Reemplaza al listado anterior, que traía la tabla completa
 * sin filtros ni paginación y mostraba a cada persona las consultas de todo el
 * personal.
 */

type Ticket = {
  id: string
  numero: number
  titulo: string
  consulta: string
  estado: string
  prioridad: string
  categoria: string
  created_at: string
  updated_at: string
  vence_en: string | null
  primera_respuesta_en: string | null
  asignado_a: string | null
  solicitante: string
  responsable: string | null
}

type Mensaje = { id: string; cuerpo: string; visibilidad: string; created_at: string; autor: string | null }
type Evento = { tipo: string; valor_anterior: string | null; valor_nuevo: string | null; created_at: string; actor: string | null }
type Detalle = Ticket & { mensajes: Mensaje[]; eventos: Evento[]; user_id: string }

const PAGE_SIZE = 25

const TONO_ESTADO: Record<string, 'ok' | 'warn' | 'danger' | 'info' | 'neutral'> = {
  'Sin asignar': 'warn',
  'En análisis': 'info',
  'Pendiente de información': 'warn',
  'En proceso': 'info',
  'Resuelto': 'ok',
  'Cerrado': 'neutral',
  'Reabierto': 'danger',
}

const TONO_PRIORIDAD: Record<string, 'ok' | 'warn' | 'danger' | 'info' | 'neutral'> = {
  'Baja': 'neutral',
  'Normal': 'info',
  'Alta': 'warn',
  'Crítica': 'danger',
}

/** Vencida = se comprometió una primera respuesta que todavía no ocurrió. */
function estaVencida(t: Ticket): boolean {
  return !t.primera_respuesta_en && !!t.vence_en && new Date(t.vence_en) < new Date()
}

function tiempoRelativo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const horas = Math.floor(ms / 3600_000)
  if (horas < 1) return 'hace minutos'
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`
}

const TEXTO_EVENTO: Record<string, string> = {
  creacion: 'abrió la consulta',
  estado: 'cambió el estado',
  prioridad: 'cambió la prioridad',
  asignacion: 'cambió el responsable',
}

export default function SoportePage({ role }: { role: string | null }) {
  // La base solo admite admin, supervisor y operador: 'administrator' era una
  // comprobación que nunca podía cumplirse.
  const esSoporte = role === 'admin' || role === 'supervisor'

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [contadores, setContadores] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<Feedback>(null)

  const [vista, setVista] = useState('abiertos')
  const [estado, setEstado] = useState('todos')
  const [prioridad, setPrioridad] = useState('todas')
  const [q, setQ] = useState('')

  const [meta, setMeta] = useState<{ estados: string[]; prioridades: string[]; categorias: string[] }>({
    estados: [], prioridades: [], categorias: [],
  })

  const [showNew, setShowNew] = useState(false)
  const [nuevo, setNuevo] = useState({ titulo: '', categoria: '', consulta: '' })
  const [creating, setCreating] = useState(false)

  const [detalle, setDetalle] = useState<Detalle | null>(null)
  const [abriendo, setAbriendo] = useState(false)
  const [respuesta, setRespuesta] = useState('')
  const [esNotaInterna, setEsNotaInterna] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [confirmarCierre, setConfirmarCierre] = useState(false)

  useEffect(() => {
    apiGet<{ data: typeof meta }>('/api/support/meta').then(r => setMeta(r.data)).catch(() => {})
  }, [])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
      if (vista === 'sin_asignar') params.set('asignado', 'sin_asignar')
      else if (vista === 'mios') params.set('asignado', 'mios')
      else params.set('vista', vista)
      if (estado !== 'todos') params.set('estado', estado)
      if (prioridad !== 'todas') params.set('prioridad', prioridad)
      if (q.trim()) params.set('q', q.trim())

      const r = await apiGet<any>(`/api/support?${params}`)
      setTickets(r.data)
      setTotal(r.pagination.total)
      setTotalPages(r.pagination.totalPages)
      setContadores(r.contadores || {})
    } catch (err: any) {
      setFeedback({ tone: 'error', text: err.message || 'No se pudieron cargar las consultas.' })
    } finally {
      setLoading(false)
    }
  }, [page, vista, estado, prioridad, q])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { setPage(1) }, [vista, estado, prioridad, q])

  async function abrirDetalle(id: string) {
    setAbriendo(true)
    try {
      const r = await apiGet<{ data: Detalle }>(`/api/support/${id}`)
      setDetalle(r.data)
    } catch (err: any) {
      setFeedback({ tone: 'error', text: err.message || 'No se pudo abrir la consulta.' })
      setDetalle(null)
    } finally {
      setAbriendo(false)
    }
  }

  async function crear() {
    if (!nuevo.titulo.trim()) return setFeedback({ tone: 'error', text: 'Poné un título breve para la consulta.' })
    if (nuevo.consulta.trim().length < 15) return setFeedback({ tone: 'error', text: 'Contanos un poco más: la descripción necesita al menos 15 caracteres.' })
    setCreating(true)
    try {
      const r = await apiPost<{ data: Ticket }>('/api/support', nuevo)
      setShowNew(false)
      setNuevo({ titulo: '', categoria: '', consulta: '' })
      setFeedback({ tone: 'success', text: `Consulta #${String(r.data.numero).padStart(4, '0')} enviada. Te vamos a responder por acá.` })
      cargar()
    } catch (err: any) {
      setFeedback({ tone: 'error', text: err.message || 'No pudimos enviar la consulta. Lo que escribiste se conserva.' })
    } finally {
      setCreating(false)
    }
  }

  async function enviarMensaje() {
    if (!respuesta.trim() || !detalle) return
    setEnviando(true)
    try {
      await apiPost(`/api/support/${detalle.id}/mensajes`, {
        cuerpo: respuesta,
        visibilidad: esNotaInterna ? 'interna' : 'visible',
      })
      setRespuesta('')
      setEsNotaInterna(false)
      await abrirDetalle(detalle.id)
      cargar()
    } catch (err: any) {
      setFeedback({ tone: 'error', text: err.message || 'No se pudo enviar el mensaje.' })
    } finally {
      setEnviando(false)
    }
  }

  async function actualizar(cambios: Record<string, any>, aviso: string) {
    if (!detalle) return
    try {
      await apiPut(`/api/support/${detalle.id}`, cambios)
      await abrirDetalle(detalle.id)
      cargar()
      setFeedback({ tone: 'success', text: aviso })
    } catch (err: any) {
      setFeedback({ tone: 'error', text: err.message || 'No se pudo actualizar la consulta.' })
    }
  }

  const VISTAS = esSoporte
    ? [
        { k: 'abiertos', l: 'Abiertas' },
        { k: 'sin_asignar', l: 'Sin asignar' },
        { k: 'mios', l: 'Asignadas a mí' },
        { k: 'vencidos', l: 'Vencidas' },
        { k: 'todos', l: 'Todas' },
      ]
    : [
        { k: 'abiertos', l: 'Abiertas' },
        { k: 'todos', l: 'Todas' },
      ]

  const hayFiltros = vista !== 'abiertos' || estado !== 'todos' || prioridad !== 'todas' || q.trim() !== ''

  return (
    <div className="space-y-5">
      <PageHeader
        title="Soporte"
        subtitle={esSoporte ? 'Consultas del personal sobre el sistema de stock.' : 'Escribinos si tenés un problema con el sistema.'}
        actions={<Button variant="primary" onClick={() => setShowNew(true)}>Nueva consulta</Button>}
      />

      <Banner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <Card>
        <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label="Vistas rápidas">
          {VISTAS.map(v => (
            <button
              key={v.k}
              onClick={() => setVista(v.k)}
              aria-pressed={vista === v.k}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wide border-2 transition-all
                focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus
                ${vista === v.k
                  ? 'bg-accent-strong text-accent-ink border-accent-strong'
                  : 'bg-paper text-ink-2 border-rule hover:border-focus'}`}
            >
              {v.l}
            </button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]">
          <div>
            <Label htmlFor="q-soporte">Buscar</Label>
            <input
              id="q-soporte"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Número, título o texto de la consulta"
              className="w-full rounded-xl border border-rule bg-paper px-4 py-2.5 text-sm outline-none focus:border-focus"
            />
          </div>
          <div>
            <Label htmlFor="estado-soporte">Estado</Label>
            <select id="estado-soporte" value={estado} onChange={e => setEstado(e.target.value)}
              className="w-full rounded-xl border border-rule bg-paper px-4 py-2.5 text-sm font-semibold outline-none focus:border-focus">
              <option value="todos">Todos</option>
              {meta.estados.map(s => (
                <option key={s} value={s}>{s}{contadores[s] ? ` (${contadores[s]})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="prio-soporte">Prioridad</Label>
            <select id="prio-soporte" value={prioridad} onChange={e => setPrioridad(e.target.value)}
              className="w-full rounded-xl border border-rule bg-paper px-4 py-2.5 text-sm font-semibold outline-none focus:border-focus">
              <option value="todas">Todas</option>
              {meta.prioridades.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {hayFiltros && (
          <button
            onClick={() => { setVista('abiertos'); setEstado('todos'); setPrioridad('todas'); setQ('') }}
            className="mt-3 text-sm font-bold text-ink-3 hover:text-ink underline underline-offset-2"
          >
            Limpiar filtros
          </button>
        )}
      </Card>

      {loading ? (
        <EmptyState icon="⏳" message="Cargando" sub="Buscando consultas…" />
      ) : !tickets.length ? (
        <EmptyState
          message={hayFiltros ? 'Sin resultados' : esSoporte ? 'No hay consultas abiertas' : 'Todavía no abriste ninguna consulta'}
          sub={hayFiltros
            ? 'Probá con otros filtros.'
            : esSoporte ? 'Cuando el personal envíe una consulta, aparece acá.' : 'Si tenés un problema con el sistema, escribinos.'}
        />
      ) : (
        <>
          <div className="grid gap-3">
            {tickets.map(t => (
              <Card key={t.id} className="hover:shadow-lg transition-shadow">
                <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-start">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-ink-3 bg-paper-3 px-2 py-1 rounded-md">
                        #{String(t.numero).padStart(4, '0')}
                      </span>
                      <Badge tone={TONO_ESTADO[t.estado] || 'neutral'}>{t.estado}</Badge>
                      <Badge tone={TONO_PRIORIDAD[t.prioridad] || 'neutral'}>{t.prioridad}</Badge>
                      {estaVencida(t) && <Badge tone="danger">Vencida</Badge>}
                    </div>
                    <p className="font-bold text-ink">{t.titulo}</p>
                    <p className="text-sm text-ink-3">{t.consulta.slice(0, 160)}{t.consulta.length > 160 ? '…' : ''}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3">
                      <span><b className="text-ink-2">{t.solicitante}</b></span>
                      <span>· {t.categoria}</span>
                      <span>· {formatFecha(t.created_at)}</span>
                      <span>· {tiempoRelativo(t.created_at)}</span>
                      {t.responsable && <span>· Atiende: <b className="text-ink-2">{t.responsable}</b></span>}
                    </div>
                  </div>
                  <Button variant="secondary" onClick={() => abrirDetalle(t.id)} className="shrink-0">
                    Ver detalle
                  </Button>
                </div>
              </Card>
            ))}
          </div>
          <Card padded={false}>
            <Pager page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
          </Card>
        </>
      )}

      {showNew && (
        <Modal
          title="Nueva consulta"
          size="lg"
          onClose={() => setShowNew(false)}
          confirmarCierre={nuevo.titulo.trim().length > 0 || nuevo.consulta.trim().length > 0}
        >
          <div className="space-y-4">
            <div>
              <Label htmlFor="n-titulo">Título</Label>
              <input
                id="n-titulo" value={nuevo.titulo} maxLength={120}
                onChange={e => setNuevo(p => ({ ...p, titulo: e.target.value }))}
                placeholder="Ej: No puedo registrar el egreso de leche"
                className="w-full rounded-xl border border-rule px-4 py-2.5 outline-none focus:border-focus"
              />
            </div>
            <div>
              <Label htmlFor="n-cat">Tipo de consulta</Label>
              <select
                id="n-cat" value={nuevo.categoria}
                onChange={e => setNuevo(p => ({ ...p, categoria: e.target.value }))}
                className="w-full rounded-xl border border-rule px-4 py-2.5 font-semibold outline-none focus:border-focus"
              >
                <option value="">Seleccioná una opción</option>
                {meta.categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="n-desc">Contanos qué pasó</Label>
              <textarea
                id="n-desc" rows={5} value={nuevo.consulta}
                onChange={e => setNuevo(p => ({ ...p, consulta: e.target.value }))}
                placeholder="Si podés, indicá en qué pantalla ocurrió y qué esperabas que sucediera."
                className="w-full rounded-xl border border-rule px-4 py-3 outline-none focus:border-focus resize-y"
              />
              <p className={`text-xs font-semibold mt-1 ${
                nuevo.consulta.trim().length > 0 && nuevo.consulta.trim().length < 15 ? 'text-state-danger' : 'text-ink-3'
              }`}>
                {nuevo.consulta.trim().length > 0 && nuevo.consulta.trim().length < 15
                  ? `Faltan ${15 - nuevo.consulta.trim().length} caracteres`
                  : 'Cuanto más detalle, más rápido podemos resolverlo.'}
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setShowNew(false)}>Cancelar</Button>
              <Button variant="primary" loading={creating} onClick={crear}>Enviar consulta</Button>
            </div>
          </div>
        </Modal>
      )}

      {(detalle || abriendo) && (
        <Modal
          title={detalle ? `Consulta #${String(detalle.numero).padStart(4, '0')}` : 'Consulta'}
          size="lg"
          onClose={() => { setDetalle(null); setRespuesta('') }}
          confirmarCierre={respuesta.trim().length > 0}
        >
          {!detalle ? (
            <EmptyState icon="⏳" message="Cargando" sub="Abriendo la consulta…" />
          ) : (
            <div className="space-y-5">
              <div className="rounded-[--radius-card] border border-rule bg-paper-2 p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={TONO_ESTADO[detalle.estado] || 'neutral'}>{detalle.estado}</Badge>
                  <Badge tone={TONO_PRIORIDAD[detalle.prioridad] || 'neutral'}>{detalle.prioridad}</Badge>
                  {estaVencida(detalle) && <Badge tone="danger">Vencida</Badge>}
                </div>
                <h3 className="font-bold text-lg text-ink">{detalle.titulo}</h3>
                <p className="text-ink-2 whitespace-pre-line">{detalle.consulta}</p>
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-3 border-t border-rule">
                  <div><dt className="text-ink-3 font-bold uppercase">Solicitante</dt><dd className="font-semibold text-ink-2">{detalle.solicitante}</dd></div>
                  <div><dt className="text-ink-3 font-bold uppercase">Tipo</dt><dd className="font-semibold text-ink-2">{detalle.categoria}</dd></div>
                  <div><dt className="text-ink-3 font-bold uppercase">Abierta</dt><dd className="font-semibold text-ink-2">{formatFecha(detalle.created_at)}</dd></div>
                  <div><dt className="text-ink-3 font-bold uppercase">Atiende</dt><dd className="font-semibold text-ink-2">{detalle.responsable || 'Sin asignar'}</dd></div>
                </dl>
              </div>

              {esSoporte && (
                <div className="flex flex-wrap items-end gap-3 rounded-[--radius-card] border border-rule p-4">
                  <div className="min-w-[160px] flex-1">
                    <Label htmlFor="d-estado">Estado</Label>
                    <select id="d-estado" value={detalle.estado}
                      onChange={e => {
                        if (e.target.value === 'Cerrado') setConfirmarCierre(true)
                        else actualizar({ estado: e.target.value }, 'Estado actualizado.')
                      }}
                      className="w-full rounded-xl border border-rule px-3 py-2 text-sm font-semibold outline-none focus:border-focus">
                      {meta.estados.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="min-w-[130px] flex-1">
                    <Label htmlFor="d-prio">Prioridad</Label>
                    <select id="d-prio" value={detalle.prioridad}
                      onChange={e => actualizar({ prioridad: e.target.value }, 'Prioridad actualizada.')}
                      className="w-full rounded-xl border border-rule px-3 py-2 text-sm font-semibold outline-none focus:border-focus">
                      {meta.prioridades.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  {!detalle.asignado_a && (
                    <Button variant="secondary" onClick={() => actualizar({ asignado_a: 'yo' }, 'Tomaste la consulta.')}>
                      Tomar el caso
                    </Button>
                  )}
                </div>
              )}

              {!esSoporte && ['Resuelto', 'Cerrado'].includes(detalle.estado) && (
                <div className="rounded-[--radius-card] border border-state-warn/25 bg-state-warn-bg p-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-state-warn font-semibold">¿El problema sigue ocurriendo?</p>
                  <Button variant="secondary" onClick={() => actualizar({ estado: 'Reabierto' }, 'Consulta reabierta.')}>
                    Reabrir consulta
                  </Button>
                </div>
              )}

              <div>
                <h4 className="font-bold text-ink mb-3">Conversación</h4>
                {detalle.mensajes.length === 0 ? (
                  <p className="text-sm text-ink-3 italic py-3">Todavía no hay respuestas.</p>
                ) : (
                  <ul className="space-y-3 max-h-[38vh] overflow-y-auto pr-1">
                    {detalle.mensajes.map(m => (
                      <li key={m.id} className={`rounded-[--radius-card] p-4 border ${
                        m.visibilidad === 'interna'
                          ? 'bg-state-warn-bg border-state-warn-bg border-dashed'
                          : 'bg-paper border-rule'
                      }`}>
                        {/* La nota interna se distingue por texto, borde punteado y
                            fondo: para algo que no debe leer el solicitante no
                            alcanza con un matiz de color. */}
                        {m.visibilidad === 'interna' && (
                          <p className="text-[10px] font-black uppercase tracking-widest text-state-warn mb-1">
                            Nota interna · no la ve el solicitante
                          </p>
                        )}
                        <p className="text-sm text-ink whitespace-pre-line">{m.cuerpo}</p>
                        <p className="text-[11px] text-ink-3 mt-2 font-semibold">
                          {m.autor || 'Sistema'} · {formatFecha(m.created_at)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {detalle.estado !== 'Cerrado' && (
                <div className="rounded-[--radius-card] border border-rule bg-paper-2 p-4 space-y-3">
                  <Label htmlFor="d-resp">Responder</Label>
                  <textarea
                    id="d-resp" rows={3} value={respuesta}
                    onChange={e => setRespuesta(e.target.value)}
                    placeholder="Escribí tu respuesta…"
                    className="w-full rounded-xl border border-rule px-4 py-3 text-sm outline-none focus:border-focus resize-y"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {esSoporte && (
                      <label className="flex items-center gap-2 text-sm font-semibold text-ink-2 cursor-pointer">
                        <input type="checkbox" checked={esNotaInterna} onChange={e => setEsNotaInterna(e.target.checked)}
                          className="h-4 w-4 rounded border-rule accent-[--color-warn]" />
                        Nota interna (no la ve el solicitante)
                      </label>
                    )}
                    <Button variant="primary" loading={enviando} disabled={!respuesta.trim()} onClick={enviarMensaje} className="ml-auto">
                      Enviar
                    </Button>
                  </div>
                </div>
              )}

              {detalle.eventos.length > 0 && (
                <details className="rounded-[--radius-card] border border-rule p-4">
                  <summary className="font-bold text-ink-2 cursor-pointer text-sm">
                    Historial ({detalle.eventos.length})
                  </summary>
                  <ul className="mt-3 space-y-2">
                    {detalle.eventos.map((e, i) => (
                      <li key={i} className="text-xs text-ink-2 flex flex-wrap gap-1">
                        <span className="font-semibold text-ink">{e.actor || 'Sistema'}</span>
                        <span>{TEXTO_EVENTO[e.tipo] || e.tipo}</span>
                        {e.valor_anterior && <span>de <b>{e.valor_anterior}</b></span>}
                        {e.valor_nuevo && <span>a <b>{e.valor_nuevo}</b></span>}
                        <span className="text-ink-3">· {formatFecha(e.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </Modal>
      )}

      {confirmarCierre && (
        <ConfirmDialog
          title="Cerrar la consulta"
          message="Una vez cerrada no se pueden agregar respuestas. El solicitante puede reabrirla si el problema continúa."
          confirmLabel="Cerrar consulta"
          tone="normal"
          onConfirm={() => { setConfirmarCierre(false); actualizar({ estado: 'Cerrado' }, 'Consulta cerrada.') }}
          onCancel={() => setConfirmarCierre(false)}
        />
      )}
    </div>
  )
}
