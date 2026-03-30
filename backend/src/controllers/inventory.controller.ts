import { type Request, type Response, type NextFunction } from 'express'
import { db } from '../database/connection'

export class InventoryController {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const rows = await db('inventory_closings as ic')
        .join('users as u', 'u.id', 'ic.user_id')
        .select('ic.id', 'ic.fecha', 'ic.status', 'ic.notes', 'u.full_name as user_full_name')
        .orderBy('ic.fecha', 'desc')
        .limit(50)
      return res.json({ data: rows })
    } catch (err) {
      return next(err)
    }
  }

  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const closing = await db('inventory_closings as ic')
        .join('users as u', 'u.id', 'ic.user_id')
        .where('ic.id', req.params.id)
        .select('ic.*', 'u.full_name as user_full_name')
        .first()
      if (!closing) return res.status(404).json({ error: 'Cierre no encontrado.' })

      const items = await db('inventory_closing_items as ici')
        .join('items as i', 'i.id', 'ici.item_id')
        .where('ici.closing_id', req.params.id)
        .select('i.code', 'i.name', 'i.unit', 'ici.stock_sistema', 'ici.stock_contado', 'ici.diferencia')

      return res.json({ data: { closing, items } })
    } catch (err) {
      return next(err)
    }
  }
}

export const inventoryController = new InventoryController()

