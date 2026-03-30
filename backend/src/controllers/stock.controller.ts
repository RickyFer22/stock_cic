import { type Response, type NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { db } from '../database/connection'
import { logger } from '../utils/logger'
import { type AuthRequest } from '../middleware/auth.middleware'
import { logAudit, extractAuditInfo } from '../services/audit.service'

const ingresoSchema = z.object({
  item_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  movement_type: z.enum(['donation', 'purchase', 'transfer_in', 'adjustment']).optional(),
  provider: z.string().max(255).optional(),
  notes: z.string().max(500).optional(),
})

const distributionSchema = z.object({
  beneficiary_id: z.string().uuid(),
  observaciones: z.string().max(500).optional(),
  items: z.array(z.object({
    item_id: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1),
})

const inventoryClosingSchema = z.object({
  notes: z.string().max(800).optional(),
  items: z.array(z.object({
    item_id: z.string().uuid(),
    stock_contado: z.number().int().min(0),
  })).min(1),
})

export class StockController {
  async getItems(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rows = await db('items as i')
        .leftJoin('categories as c', 'c.id', 'i.category_id')
        .where('i.is_active', true)
        .select('i.*', 'c.name as category')
        .orderBy('i.name')
        .limit(1000)
      return res.json({ data: rows })
    } catch (err) {
      return next(err)
    }
  }

  async getMovements(req: AuthRequest, res: Response, next: NextFunction) {
    const { limit = '50', page = '1', kind, from, to } = req.query as Record<string, string>
    const pageNum = parseInt(page, 10)
    const pageSize = parseInt(limit, 10)
    const offset = (pageNum - 1) * pageSize
    try {
      const baseQuery = db('stock_movements')
      if (kind) {
        const normalizedKind = kind === 'OUTBOUND' ? 'DISTRIBUTION' : kind
        baseQuery.where('kind', normalizedKind)
      }
      if (from) baseQuery.where('fecha', '>=', from)
      if (to) baseQuery.where('fecha', '<=', to)

      const [totalResult] = await baseQuery.clone().count('* as count')
      const total = Number(totalResult.count)

      const rowsQuery = db('stock_movements as sm')
        .join('items as i', 'i.id', 'sm.item_id')
        .join('users as u', 'u.id', 'sm.user_id')
        .select(
          'sm.id',
          'sm.fecha',
          'sm.kind',
          'sm.movement_type',
          'sm.quantity',
          'sm.counterparty',
          'sm.notes',
          'i.code',
          'i.name as item_name',
          'u.full_name as operador',
        )

      if (kind) {
        const normalizedKind = kind === 'OUTBOUND' ? 'DISTRIBUTION' : kind
        rowsQuery.where('sm.kind', normalizedKind)
      }
      if (from) rowsQuery.where('sm.fecha', '>=', from)
      if (to) rowsQuery.where('sm.fecha', '<=', to)

      const rows = await rowsQuery
        .orderBy('sm.fecha', 'desc')
        .limit(pageSize)
        .offset(offset)

      return res.json({
        data: rows,
        pagination: {
          page: pageNum,
          limit: pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      })
    } catch (err) {
      return next(err)
    }
  }

  async getMovement(req: AuthRequest, res: Response, next: NextFunction) {
    const id = req.params.id
    try {
      const row = await db('stock_movements as sm')
        .join('items as i', 'i.id', 'sm.item_id')
        .join('users as u', 'u.id', 'sm.user_id')
        .where('sm.id', id)
        .select(
          'sm.id',
          'sm.fecha',
          'sm.movement_type',
          'sm.counterparty',
          'sm.notes',
          'sm.quantity',
          'i.code',
          'i.name as item_name',
          'i.unit',
          'u.full_name as operador',
        )
        .first()

      if (!row) {
        return res.status(404).json({ error: 'Movimiento no encontrado.' })
      }

      const detail = {
        id: row.id,
        fecha: row.fecha,
        movement_type: row.movement_type,
        counterparty: row.counterparty,
        notes: row.notes,
        operador: row.operador,
        items: [
          {
            name: row.item_name,
            code: row.code,
            unit: row.unit,
            quantity: Math.abs(row.quantity),
          }
        ]
      }
      return res.json({ data: detail })
    } catch (err) {
      return next(err)
    }
  }

  async createIngreso(req: AuthRequest, res: Response, next: NextFunction) {
    const parsed = ingresoSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos.' })
    if (!req.user) return res.status(401).json({ error: 'No autenticado.' })

    const { item_id, quantity, notes, movement_type, provider } = parsed.data
    const ip = req.ip
    const userId = req.user.id
    const auditInfo = extractAuditInfo(req)

    try {
      const itemBefore = await db('items').where({ id: item_id }).select('stock_actual').first()
      const movementId = uuidv4()
      await db.transaction(async (trx) => {
        await trx('stock_movements').insert({
          id: movementId,
          item_id,
          user_id: userId,
          kind: 'INGRESO',
          movement_type: movement_type || null,
          quantity,
          counterparty: provider || null,
          notes: notes || null,
          ip,
        })
      })

      const itemAfter = await db('items').where({ id: item_id }).select('stock_actual').first()
      await logAudit({
        ...auditInfo,
        action: 'CREATE',
        entityType: 'stock_movement',
        entityId: movementId,
        newValues: { item_id, quantity, movement_type, provider },
      })

      logger.info({ action: 'STOCK_INGRESO', userId, ip, itemId: item_id, quantity, movementId, movement_type, provider })
      return res.status(201).json({ data: { id: movementId } })
    } catch (err) {
      return next(err)
    }
  }

  async createOutbound(req: AuthRequest, res: Response, next: NextFunction) {
    const schema = z.object({
      items: z.array(z.object({
        item_id: z.string().uuid(),
        quantity: z.number().int().positive(),
      })).min(1),
      movement_type: z.enum(['delivery', 'transfer_out', 'waste', 'adjustment']),
      destination: z.string().max(255),
      notes: z.string().max(500).optional(),
    })

    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos.', details: parsed.error.issues })
    if (!req.user) return res.status(401).json({ error: 'No autenticado.' })

    const { items, movement_type, destination, notes } = parsed.data
    const ip = req.ip
    const userId = req.user.id
    const auditInfo = extractAuditInfo(req)

    // Deduplicación simple de ítems: suma cantidades por item_id
    const aggregated = new Map<string, number>()
    for (const it of items) aggregated.set(it.item_id, (aggregated.get(it.item_id) || 0) + it.quantity)
    const normalizedItems = [...aggregated.entries()].map(([item_id, quantity]) => ({ item_id, quantity }))

    try {
      const parentId = uuidv4()

      await db.transaction(async (trx) => {
        for (const it of normalizedItems) {
          await trx('stock_movements').insert({
            id: uuidv4(),
            item_id: it.item_id,
            user_id: userId,
            kind: 'DISTRIBUTION',
            movement_type,
            quantity: -Math.abs(it.quantity),
            counterparty: destination,
            notes: notes || null,
            ip,
          })
        }
      })

      await logAudit({
        ...auditInfo,
        action: 'CREATE',
        entityType: 'outbound',
        newValues: { items: normalizedItems, movement_type, destination },
      })

      logger.info({ action: 'STOCK_OUTBOUND', userId, ip, items: normalizedItems, movement_type, destination })
      return res.status(201).json({ data: { success: true } })
    } catch (err) {
      return next(err)
    }
  }

  async createDistribution(req: AuthRequest, res: Response, next: NextFunction) {
    const parsed = distributionSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos.' })
    if (!req.user) return res.status(401).json({ error: 'No autenticado.' })

    const { beneficiary_id, observaciones, items } = parsed.data
    const ip = req.ip
    const userId = req.user.id
    const auditInfo = extractAuditInfo(req)

    // Deduplicación simple de ítems: suma cantidades por item_id
    const aggregated = new Map<string, number>()
    for (const it of items) aggregated.set(it.item_id, (aggregated.get(it.item_id) || 0) + it.quantity)
    const normalizedItems = [...aggregated.entries()].map(([item_id, quantity]) => ({ item_id, quantity }))

    try {
      const distributionId = uuidv4()
      await db.transaction(async (trx) => {
        await trx('distributions').insert({
          id: distributionId,
          beneficiary_id,
          user_id: userId,
          observaciones: observaciones || null,
          ip,
        })

        for (const it of normalizedItems) {
          await trx('distribution_items').insert({
            id: uuidv4(),
            distribution_id: distributionId,
            item_id: it.item_id,
            quantity: it.quantity,
          })

          // quantity negativa: egreso. El trigger de DB actualiza items.stock_actual y bloquea stock < 0.
          await trx('stock_movements').insert({
            id: uuidv4(),
            item_id: it.item_id,
            user_id: userId,
            kind: 'DISTRIBUTION',
            quantity: -Math.abs(it.quantity),
            distribution_id: distributionId,
            notes: observaciones || null,
            ip,
          })
        }
      })

      await logAudit({
        ...auditInfo,
        action: 'CREATE',
        entityType: 'distribution',
        entityId: distributionId,
        newValues: { beneficiary_id, items: normalizedItems, observaciones },
      })

      logger.info({ action: 'STOCK_DISTRIBUTION', userId, ip, distributionId, items: normalizedItems })
      return res.status(201).json({ data: { id: distributionId } })
    } catch (err) {
      return next(err)
    }
  }

  async createInventoryClosing(req: AuthRequest, res: Response, next: NextFunction) {
    const parsed = inventoryClosingSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos.' })
    if (!req.user) return res.status(401).json({ error: 'No autenticado.' })

    const { notes, items } = parsed.data
    const ip = req.ip
    const userId = req.user.id

    try {
      const closingId = uuidv4()
      await db.transaction(async (trx) => {
        await trx('inventory_closings').insert({
          id: closingId,
          user_id: userId,
          notes: notes || null,
          status: 'CLOSED',
          ip,
        })

        for (const it of items) {
          const row = await trx('items').where({ id: it.item_id }).select('stock_actual').first()
          if (!row) {
            const e: any = new Error('Ítem no encontrado en cierre.')
            e.status = 404
            throw e
          }

          const stockSistema = Number(row.stock_actual)
          const diferencia = it.stock_contado - stockSistema

          await trx('inventory_closing_items').insert({
            id: uuidv4(),
            closing_id: closingId,
            item_id: it.item_id,
            stock_sistema: stockSistema,
            stock_contado: it.stock_contado,
            diferencia,
          })

          if (diferencia !== 0) {
            await trx('stock_movements').insert({
              id: uuidv4(),
              item_id: it.item_id,
              user_id: userId,
              kind: 'ADJUSTMENT',
              quantity: diferencia,
              closing_id: closingId,
              notes: notes || 'Ajuste por cierre de inventario',
              ip,
            })
          }
        }
      })

      logger.info({ action: 'INVENTORY_CLOSING', userId, ip, closingId, itemCount: items.length })
      return res.status(201).json({ data: { id: closingId } })
    } catch (err) {
      return next(err)
    }
  }

  async searchBeneficiaries(req: AuthRequest, res: Response, next: NextFunction) {
    const q = String((req.query as any).q || '').trim()
    if (!q) return res.json({ data: [] })

    try {
      // DNI: búsqueda prefijo (rápida con índice)
      if (/^\d+$/.test(q)) {
        const rows = await db('beneficiaries')
          .where('dni', 'like', `${q}%`)
          .andWhere('is_active', true)
          .select('id', 'dni', 'apellido', 'nombre')
          .orderBy('dni')
          .limit(20)
        return res.json({ data: rows })
      }

      // Apellido/nombre: trigram + fonética (fuzzystrmatch) para evitar duplicados
      const rows = await db
        .select('id', 'dni', 'apellido', 'nombre')
        .from('beneficiaries')
        .where('is_active', true)
        .andWhere((qb) => {
          qb.whereRaw('similarity(sr_unaccent(apellido), sr_unaccent(?)) > 0.25', [q])
          qb.orWhereRaw('sr_dmetaphone(apellido) = sr_dmetaphone(?)', [q])
          qb.orWhereRaw('sr_unaccent(apellido) ILIKE sr_unaccent(?)', [`%${q}%`])
        })
        .orderByRaw('similarity(sr_unaccent(apellido), sr_unaccent(?)) DESC', [q])
        .limit(20)

      return res.json({ data: rows })
    } catch (err) {
      return next(err)
    }
  }
}

export const stockController = new StockController()
