import { type Request, type Response, type NextFunction } from 'express'
import { db } from '../database/connection'

export class SupportController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const tickets = await db('support_tickets as t')
        .join('users as u', 'u.id', 't.user_id')
        .select('t.*', 'u.full_name as username')
        .orderBy('t.created_at', 'desc')

      return res.json({ data: tickets })
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

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params
      const { estado, respuestas } = req.body

      const payload: any = { updated_at: db.fn.now() }
      if (estado) payload.estado = estado
      if (respuestas) {
        payload.respuestas = JSON.stringify(respuestas)
        if (respuestas.length > 0) {
          payload.ultimo_mensaje = respuestas[respuestas.length - 1].mensaje
        }
      }

      const [ticket] = await db('support_tickets')
        .where({ id })
        .update(payload)
        .returning('*')

      if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado.' })

      return res.json({ data: ticket })
    } catch (err) {
      return next(err)
    }
  }
}

export const supportController = new SupportController()
