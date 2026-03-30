import { Request, Response, NextFunction } from 'express'
import { db } from '../database/connection'

export class DistributionsController {

  async list(req: Request, res: Response, next: NextFunction) {
    const { limit = '30', page = '1' } = req.query as Record<string, string>
    const offset = (parseInt(page) - 1) * parseInt(limit)
    try {
      const rows = await db('distributions as d')
        .join('beneficiaries as b', 'b.id', 'd.beneficiary_id')
        .join('users as u', 'u.id', 'd.user_id')
        .select(
          'd.id', 'd.fecha', 'd.observaciones',
          db.raw(`CONCAT(b.apellido, ', ', b.nombre) as beneficiario`),
          'b.dni', 'u.full_name as operador'
        )
        .orderBy('d.fecha', 'desc')
        .limit(parseInt(limit))
        .offset(offset)

      res.json({ data: rows })
    } catch (err) { next(err) }
  }

  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const distribution = await db('distributions as d')
        .join('beneficiaries as b', 'b.id', 'd.beneficiary_id')
        .join('users as u', 'u.id', 'd.user_id')
        .where('d.id', req.params.id)
        .select(
          'd.id', 'd.fecha', 'd.observaciones',
          'b.dni', 'b.apellido', 'b.nombre', 'b.direccion', 'b.barrio',
          'u.full_name as operador'
        )
        .first()

      if (!distribution) {
        return res.status(404).json({ error: 'Distribución no encontrada.' })
      }

      const items = await db('distribution_items as di')
        .join('items as i', 'i.id', 'di.item_id')
        .where('di.distribution_id', req.params.id)
        .select('i.name', 'i.code', 'i.unit', 'di.quantity')

      res.json({ data: { distribution, items } })
    } catch (err) { next(err) }
  }
}

export const distributionsController = new DistributionsController()
