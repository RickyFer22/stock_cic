import { type Request, type Response, type NextFunction } from 'express'
import { db } from '../database/connection'

/** Quienes atienden soporte ven todas las consultas; el resto, solo las propias. */
function esSoporte(req: Request): boolean {
  const rol = (req as any).user?.role
  return rol === 'admin' || rol === 'supervisor'
}

export class SupportController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      // Antes esta consulta devolvia la tabla completa a cualquier usuario
      // autenticado: todo el personal leia las consultas de todo el personal,
      // con su contenido y autoria. Ahora se acota por usuario salvo soporte.
      const query = db('support_tickets as t')
        .join('users as u', 'u.id', 't.user_id')
        .select('t.*', 'u.full_name as username')
        .orderBy('t.created_at', 'desc')

      if (!esSoporte(req)) {
        query.where('t.user_id', (req as any).user.id)
      }

      const tickets = await query
      return res.json({ data: tickets })
    } catch (err) {
      return next(err)
    }
  }

  /**
   * Agrega un mensaje al hilo. Lo puede usar quien abrio la consulta y tambien
   * soporte, que es lo que faltaba: la caja de respuesta se mostraba a todos
   * pero el unico endpoint disponible exigia admin o supervisor, asi que el
   * solicitante recibia un error al enviar.
   *
   * El mensaje se agrega en la base con el operador || de jsonb, no reemplazando
   * el arreglo completo desde el cliente. Eso elimina la perdida de mensajes
   * cuando dos personas responden a la vez.
   */
  async addMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params
      const { mensaje } = req.body
      if (!mensaje || typeof mensaje !== 'string' || !mensaje.trim()) {
        return res.status(400).json({ error: 'El mensaje no puede estar vacío.' })
      }

      const ticket = await db('support_tickets').where({ id }).first()
      if (!ticket) return res.status(404).json({ error: 'Consulta no encontrada.' })

      const actor = (req as any).user
      const esAutor = ticket.user_id === actor.id
      if (!esAutor && !esSoporte(req)) {
        return res.status(403).json({ error: 'No tiene permisos para responder esta consulta.' })
      }

      const nuevo = {
        rol: esSoporte(req) ? 'admin' : 'usuario',
        autor: actor.full_name || actor.username || '',
        mensaje: mensaje.trim(),
        fecha: new Date().toISOString(),
      }

      const [actualizado] = await db('support_tickets')
        .where({ id })
        .update({
          respuestas: db.raw("COALESCE(respuestas, '[]'::jsonb) || ?::jsonb", [JSON.stringify([nuevo])]),
          ultimo_mensaje: nuevo.mensaje,
          updated_at: db.fn.now(),
        })
        .returning('*')

      return res.json({ data: actualizado })
    } catch (err) {
      return next(err)
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { consulta } = req.body
      if (!consulta || typeof consulta !== 'string' || !consulta.trim()) {
        return res.status(400).json({ error: 'La consulta es requerida.' })
      }

      const [ticket] = await db('support_tickets')
        .insert({
          user_id: (req as any).user.id,
          consulta: consulta.trim(),
          estado: 'Pendiente',
        })
        .returning('*')

      const ticketWithUser = await db('support_tickets as t')
        .join('users as u', 'u.id', 't.user_id')
        .where('t.id', ticket.id)
        .select('t.*', 'u.full_name as username')
        .first()

      return res.status(201).json({ data: ticketWithUser })
    } catch (err) {
      return next(err)
    }
  }

  /**
   * Cambio de estado. Ya no acepta `respuestas`: reemplazar el arreglo completo
   * desde el cliente hacia que dos personas respondiendo a la vez se pisaran los
   * mensajes. Para eso esta addMessage().
   */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params
      const { estado } = req.body

      const ESTADOS = ['Pendiente', 'En Proceso', 'Resuelto', 'Cerrado']
      if (!estado || !ESTADOS.includes(estado)) {
        return res.status(400).json({ error: `Estado inválido. Valores admitidos: ${ESTADOS.join(', ')}.` })
      }

      const [ticket] = await db('support_tickets')
        .where({ id })
        .update({ estado, updated_at: db.fn.now() })
        .returning('*')

      if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado.' })

      return res.json({ data: ticket })
    } catch (err) {
      return next(err)
    }
  }
}

export const supportController = new SupportController()
