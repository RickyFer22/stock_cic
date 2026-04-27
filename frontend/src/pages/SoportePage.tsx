import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPut } from '../api/client'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'

export default function SoportePage({ role }: { role: string | null }) {
  const isAdmin = role === 'admin' || role === 'administrator' || role === 'supervisor'

  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newConsulta, setNewConsulta] = useState('')
  const [creating, setCreating] = useState(false)
  const [viewTicket, setViewTicket] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)

  useEffect(() => { loadTickets() }, [])

  const loadTickets = async () => {
    try {
      setLoading(true)
      const res = await apiGet<{ data: any[] }>('/api/support')
      setTickets(res.data || [])
    } catch (err: any) {
      alert(err.message || 'Error al cargar tickets')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newConsulta.trim()) return alert('Escriba su consulta')
    try {
      setCreating(true)
      await apiPost('/api/support', { consulta: newConsulta })
      alert('Ticket creado exitosamente')
      setNewConsulta('')
      setShowNewForm(false)
      loadTickets()
    } catch (err: any) {
      alert(err.message || 'Error al crear ticket')
    } finally {
      setCreating(false)
    }
  }

  const handleView = (ticket: any) => {
    setViewTicket(ticket)
    setMessages(ticket.respuestas || [])
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !viewTicket) return
    try {
      setSendingMessage(true)
      const nuevasRespuestas = [...(viewTicket.respuestas || []), { rol: isAdmin ? 'admin' : 'usuario', mensaje: newMessage, fecha: new Date().toISOString() }]
      await apiPut(`/api/support/${viewTicket.id}`, { respuestas: nuevasRespuestas })
      setNewMessage('')
      setMessages(nuevasRespuestas)
      setViewTicket({ ...viewTicket, respuestas: nuevasRespuestas })
      loadTickets()
    } catch (err: any) {
      alert(err.message || 'Error al enviar mensaje')
    } finally {
      setSendingMessage(false)
    }
  }

  const handleEstado = async (ticketId: string, estado: string) => {
    try {
      await apiPut(`/api/support/${ticketId}`, { estado })
      alert('Estado actualizado')
      loadTickets()
      if (viewTicket?.id === ticketId) setViewTicket({ ...viewTicket, estado })
    } catch (err: any) {
      alert(err.message || 'Error al cambiar estado')
    }
  }

  const fmtDate = (d: string) => {
    if (!d) return '-'
    const dt = new Date(d)
    return dt.toLocaleDateString('es-AR') + ' ' + dt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  }

  const estadoColor: any = {
    Pendiente: 'bg-amber-100 text-amber-700 border-amber-200',
    'En Proceso': 'bg-blue-100 text-blue-700 border-blue-200',
    Resuelto: 'bg-brand-green-100 text-brand-green-700 border-brand-green-200',
    Cerrado: 'bg-slate-100 text-slate-600 border-slate-200',
  }

  if (loading) return <EmptyState message="Cargando" sub="Obteniendo tickets..." icon="⏳" />

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-green-700 via-teal-600 to-brand-green-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-10 pointer-events-none">
          <svg className="w-48 h-48" fill="currentColor" viewBox="0 0 24 24"><path d="M18.364 5.636a9 9 0 010 12.728m-2.829-2.829a5 5 0 000-7.07m-4.243 1.414a2 2 0 113.536 3.536L12 14l-2.828-2.828z" /></svg>
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              Soporte Técnico
            </h1>
            <p className="text-white/70 mt-1">Gestión de consultas y tickets de soporte (Stock CIC)</p>
          </div>
          <button onClick={() => setShowNewForm(true)} className="bg-white text-brand-green-700 hover:bg-brand-green-50 px-6 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m-6 0H6" /></svg>
            Abrir Nuevo Ticket
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Soporte Info Card */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white/80 backdrop-blur-md rounded-[2rem] border border-white/60 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-br from-brand-green-600 to-teal-700 p-5 text-white">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Datos de Soporte
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-brand-green-50 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-brand-green-100 flex items-center justify-center text-brand-green-600">👤</div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Administrador</p>
                  <p className="font-bold text-slate-900">Ricardo Fernández</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-teal-50 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-600">🏢</div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Área</p>
                  <p className="font-bold text-slate-900">Dirección de Modernización</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-brand-gold-50 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-brand-gold-100 flex items-center justify-center text-brand-gold-600">🕒</div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Horario de Atención</p>
                  <p className="font-bold text-slate-900">Lunes a Viernes: 7:00hs a 13:00hs</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Tickets */}
        <div className="lg:col-span-2 space-y-4">
          {tickets.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-md rounded-[2rem] border border-white/60 p-12 text-center shadow-sm">
              <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900">No hay tickets generados</h3>
              <p className="text-slate-500 mt-1 text-sm">Aún no has creado consultas de soporte.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {tickets.map(t => (
                <div key={t.id} className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono bg-slate-100 text-slate-500 px-2 py-1 rounded-md border border-slate-200">#{t.id.slice(0, 8)}</span>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${estadoColor[t.estado] || estadoColor['Pendiente']}`}>
                        {t.estado}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">{fmtDate(t.created_at)}</span>
                    </div>
                    <p className="text-slate-800 font-medium truncate">{t.consulta}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-bold text-brand-green-700">👤 {t.username}</span>
                      {t.ultimo_mensaje && (
                        <span className="truncate">· <span className="italic text-slate-400">"{t.ultimo_mensaje}"</span></span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => handleView(t)} className="w-full sm:w-auto whitespace-nowrap px-4 py-2 bg-slate-50 hover:bg-brand-green-50 text-brand-green-700 font-bold border border-slate-200 hover:border-brand-green-200 rounded-xl transition-colors text-sm shadow-sm flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    Ver detalle
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showNewForm && (
        <Modal title="Nuevo Ticket" onClose={() => setShowNewForm(false)} size="md">
          <div className="space-y-4 p-2">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Descripción del problema o consulta</label>
              <textarea
                value={newConsulta}
                onChange={e => setNewConsulta(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-brand-green-500/20 focus:border-brand-green-500 outline-none transition-all resize-none"
                rows={4}
                placeholder="Ej: No puedo actualizar el stock del artículo..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowNewForm(false)} className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors">Cancelar</button>
              <button disabled={creating} onClick={handleCreate} className="px-5 py-2.5 rounded-xl font-bold bg-brand-green-700 text-white hover:bg-brand-green-800 transition-colors disabled:opacity-50">
                {creating ? 'Guardando...' : 'Crear Ticket'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {viewTicket && (
        <Modal title={`Ticket #${viewTicket.id.slice(0, 8)}`} onClose={() => setViewTicket(null)} size="lg">
          <div className="space-y-6">
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Consulta original</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${estadoColor[viewTicket.estado] || estadoColor['Pendiente']}`}>
                  {viewTicket.estado}
                </span>
              </div>
              <p className="text-slate-800 font-medium text-lg">{viewTicket.consulta}</p>
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {fmtDate(viewTicket.created_at)} por {viewTicket.username}
              </p>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Cambiar Estado:</label>
                <select
                  value={viewTicket.estado}
                  onChange={(e) => handleEstado(viewTicket.id, e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-bold outline-none cursor-pointer"
                >
                  <option value="Pendiente">Pendiente</option>
                  <option value="En Proceso">En Proceso</option>
                  <option value="Resuelto">Resuelto</option>
                  <option value="Cerrado">Cerrado</option>
                </select>
              </div>
            )}

            <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                <svg className="w-5 h-5 text-brand-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                Conversación
              </h4>
              {messages.length === 0 ? (
                <p className="text-sm text-slate-500 italic text-center py-4">Aún no hay respuestas en este ticket.</p>
              ) : (
                messages.map((m: any, idx: number) => (
                  <div key={idx} className={`flex ${m.rol === 'admin' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${m.rol === 'admin' ? 'bg-white border border-slate-200 rounded-tl-sm' : 'bg-brand-green-900 text-white rounded-tr-sm'}`}>
                      <p className="text-sm">{m.mensaje}</p>
                      <div className={`text-[10px] mt-2 flex items-center gap-1 ${m.rol === 'admin' ? 'text-slate-400' : 'text-brand-green-200'}`}>
                        <span className="font-bold uppercase tracking-wider">{m.rol === 'admin' ? 'Soporte Técnico' : 'Usuario'}</span>
                        <span>·</span>
                        <span>{fmtDate(m.fecha)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-3 items-end bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex-1">
                <textarea
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Escribir una respuesta..."
                  className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-green-500/20 focus:border-brand-green-500 outline-none transition-all resize-none"
                  rows={2}
                />
              </div>
              <button disabled={sendingMessage || !newMessage.trim()} onClick={handleSendMessage} className="px-5 py-3 rounded-xl bg-brand-green-700 text-white font-bold hover:bg-brand-green-800 transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                Enviar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
