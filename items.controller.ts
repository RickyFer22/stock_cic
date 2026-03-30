import { Request, Response, NextFunction } from 'express'
import { db } from '../database/connection'
import { v4 as uuidv4 } from 'uuid'

export class ItemsController {

  async create(req: Request, res: Response, next: NextFunction) {
    const { code, name, description, category_id, unit, stock_actual, stock_minimo, stock_maximo } = req.body
    if (!code || !name) {
      return res.status(400).json({ error: 'code y name son requeridos.' })
    }
    try {
      const [item] = await db('items').insert({
        id: uuidv4(), code, name, description: description || null,
        category_id: category_id || null, unit: unit || 'unidad',
        stock_actual: stock_actual ?? 0,
        stock_minimo: stock_minimo ?? 0,
        stock_maximo: stock_maximo || null,
      }).returning('*')
      res.status(201).json({ data: item })
    } catch (err) { next(err) }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    const { id } = req.params
    const { name, description, category_id, unit, stock_minimo, stock_maximo, is_active } = req.body
    try {
      const [item] = await db('items').where({ id }).update({
        name, description, category_id, unit,
        stock_minimo, stock_maximo,
        ...(is_active !== undefined && { is_active }),
      }).returning('*')
      if (!item) return res.status(404).json({ error: 'Ítem no encontrado.' })
      res.json({ data: item })
    } catch (err) { next(err) }
  }

  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await db('items as i')
        .leftJoin('categories as c', 'c.id', 'i.category_id')
        .where('i.id', req.params.id)
        .select('i.*', 'c.name as category')
        .first()
      if (!item) return res.status(404).json({ error: 'Ítem no encontrado.' })
      res.json({ data: item })
    } catch (err) { next(err) }
  }
}

export const itemsController = new ItemsController()
