import { type Request, type Response, type NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { db } from '../database/connection'

const createSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  category_id: z.string().uuid().nullable().optional(),
  unit: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  expiry_date: z.string().nullable().optional(),
  stock_minimo: z.number().int().min(0).optional(),
  stock_maximo: z.number().int().min(0).nullable().optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  unit: z.string().min(1).optional(),
  location: z.string().min(1).nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  stock_minimo: z.number().int().min(0).optional(),
  stock_maximo: z.number().int().min(0).nullable().optional(),
  is_active: z.boolean().optional(),
})

export class ItemsController {
  async create(req: Request, res: Response, next: NextFunction) {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos.' })

    const payload = parsed.data
    try {
      const [item] = await db('items')
        .insert({
          id: uuidv4(),
          code: payload.code,
          name: payload.name,
          description: payload.description || null,
          category_id: payload.category_id ?? null,
          unit: payload.unit || 'unidad',
          location: payload.location || null,
          expiry_date: payload.expiry_date || null,
          stock_actual: 0,
          stock_minimo: payload.stock_minimo ?? 0,
          stock_maximo: payload.stock_maximo ?? null,
        })
        .returning('*')

      // Webhook: notify Acción Social to create assistance type
      try {
        const ACCION_SOCIAL_API = process.env.ACCION_SOCIAL_API_URL || 'http://sanroque_backend:3001'
        const INTERNAL_KEY = process.env.STOCK_INTERNAL_KEY || 'san-roque-stock-sync-2026'
        
        fetch(`${ACCION_SOCIAL_API}/api/config/sync-stock-item`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Internal-Key': INTERNAL_KEY },
          body: JSON.stringify({ item_id: item.id, code: item.code, name: item.name })
        }).then(r => {
          if (r.ok) console.log(`Synced item "${item.name}" to Acción Social`)
          else console.warn(`Failed to sync item to Acción Social: ${r.status}`)
        }).catch(e => console.warn('Acción Social sync error (non-blocking):', e.message))
      } catch (_) { /* non-blocking */ }

      return res.status(201).json({ data: item })
    } catch (err) {
      return next(err)
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos.' })

    try {
      const [item] = await db('items')
        .where({ id: req.params.id })
        .update(parsed.data)
        .returning('*')

      if (!item) return res.status(404).json({ error: 'Ítem no encontrado.' })
      return res.json({ data: item })
    } catch (err) {
      return next(err)
    }
  }

  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await db('items as i')
        .leftJoin('categories as c', 'c.id', 'i.category_id')
        .where('i.id', req.params.id)
        .select('i.*', 'c.name as category')
        .first()

      if (!item) return res.status(404).json({ error: 'Ítem no encontrado.' })
      return res.json({ data: item })
    } catch (err) {
      return next(err)
    }
  }
}

export const itemsController = new ItemsController()
