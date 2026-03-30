import { type Response, type NextFunction } from 'express'
import { db } from '../database/connection'
import { type AuthRequest } from '../middleware/auth.middleware'

export class StatisticsController {
  async stockByCategory(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rows = await db('items as i')
        .leftJoin('categories as c', 'c.id', 'i.category_id')
        .where('i.is_active', true)
        .groupBy('c.name')
        .select(db.raw('COALESCE(c.name, \'Sin categoría\') as category'))
        .sum({ stock_total: 'i.stock_actual' })
        .count({ items_count: 'i.id' })
        .orderBy('stock_total', 'desc')

      return res.json({ data: rows })
    } catch (err) {
      return next(err)
    }
  }

  async movements(req: AuthRequest, res: Response, next: NextFunction) {
    const from = String((req.query as any).from || '')
    const to = String((req.query as any).to || '')
    if (!from || !to) return res.status(400).json({ error: 'from y to son requeridos (YYYY-MM-DD).' })

    try {
      const rows = await db('stock_movements')
        .where('fecha', '>=', `${from}T00:00:00.000Z`)
        .andWhere('fecha', '<=', `${to}T23:59:59.999Z`)
        .select(db.raw("date_trunc('day', fecha) as day"))
        .sum({
          inbound: db.raw("CASE WHEN kind='INGRESO' THEN quantity ELSE 0 END"),
        })
        .sum({
          outbound: db.raw("CASE WHEN quantity < 0 THEN abs(quantity) ELSE 0 END"),
        })
        .count({ movements: 'id' })
        .groupBy('day')
        .orderBy('day', 'asc')

      return res.json({ data: rows })
    } catch (err) {
      return next(err)
    }
  }

  async dashboardSummary(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const today = new Date()
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay())

      const [totalItems, lowStockItems, totalBeneficiaries, monthlyMovements, weeklyMovements] = await Promise.all([
        db('items').where('is_active', true).count('* as count').first(),
        db('items').whereRaw('stock_actual <= stock_minimo AND is_active = true').count('* as count').first(),
        db('beneficiaries').where('is_active', true).count('* as count').first(),
        db('stock_movements')
          .where('fecha', '>=', startOfMonth.toISOString())
          .count('* as count').first(),
        db('stock_movements')
          .where('fecha', '>=', startOfWeek.toISOString())
          .count('* as count').first(),
      ])

      const topItems = await db('items as i')
        .leftJoin('categories as c', 'c.id', 'i.category_id')
        .where('i.is_active', true)
        .orderBy('i.stock_actual', 'desc')
        .limit(5)
        .select('i.id', 'i.name', 'i.stock_actual', 'i.stock_minimo', 'c.name as category')

      const recentMovements = await db('stock_movements as sm')
        .join('items as i', 'i.id', 'sm.item_id')
        .join('users as u', 'u.id', 'sm.user_id')
        .orderBy('sm.fecha', 'desc')
        .limit(10)
        .select('sm.id', 'sm.fecha', 'sm.kind', 'sm.quantity', 'i.name as item_name', 'u.full_name as operador')

      return res.json({
        data: {
          totalItems: Number(totalItems?.count || 0),
          lowStockItems: Number(lowStockItems?.count || 0),
          totalBeneficiaries: Number(totalBeneficiaries?.count || 0),
          monthlyMovements: Number(monthlyMovements?.count || 0),
          weeklyMovements: Number(weeklyMovements?.count || 0),
          topItems,
          recentMovements,
        }
      })
    } catch (err) {
      return next(err)
    }
  }

  async inventoryHealth(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      // Verificar si la columna expiry_date existe en la BD (para compatibilidad con esquemas antiguos).
      const hasExpiryDateColumn = await db('information_schema.columns')
        .where({
          table_schema: 'public',
          table_name: 'items',
          column_name: 'expiry_date',
        })
        .first()

      const [total, lowStock, outOfStock, overStock, expiringSoon] = await Promise.all([
        db('items').where('is_active', true).count('* as count').first(),
        db('items').whereRaw('stock_actual <= stock_minimo AND stock_actual > 0 AND is_active = true').count('* as count').first(),
        db('items').whereRaw('stock_actual = 0 AND is_active = true').count('* as count').first(),
        db('items').whereRaw('stock_maximo IS NOT NULL AND stock_actual > stock_maximo AND is_active = true').count('* as count').first(),
        hasExpiryDateColumn
          ? db('items')
              .whereRaw("expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE + interval '30 days' AND expiry_date >= CURRENT_DATE AND is_active = true")
              .count('* as count')
              .first()
          : Promise.resolve({ count: 0 }),
      ])

      const itemsLowStock = await db('items as i')
        .leftJoin('categories as c', 'c.id', 'i.category_id')
        .whereRaw('i.stock_actual <= i.stock_minimo AND i.is_active = true')
        .orderBy('i.stock_actual', 'asc')
        .limit(10)
        .select('i.id', 'i.name', 'i.code', 'i.stock_actual', 'i.stock_minimo', 'c.name as category')

      const itemsExpiring = hasExpiryDateColumn
        ? await db('items')
            .whereRaw("expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE + interval '30 days' AND expiry_date >= CURRENT_DATE AND is_active = true")
            .orderBy('expiry_date', 'asc')
            .limit(10)
            .select('id', 'name', 'code', 'stock_actual', 'expiry_date')
        : []

      return res.json({
        data: {
          total: Number(total?.count || 0),
          lowStock: Number(lowStock?.count || 0),
          outOfStock: Number(outOfStock?.count || 0),
          overStock: Number(overStock?.count || 0),
          expiringSoon: Number(expiringSoon?.count || 0),
          itemsLowStock,
          itemsExpiring,
        }
      })
    } catch (err) {
      return next(err)
    }
  }

  async movementsByType(req: AuthRequest, res: Response, next: NextFunction) {
    const days = parseInt(String(req.query.days || '30'), 10)
    const from = new Date()
    from.setDate(from.getDate() - days)

    try {
      const byKind = await db('stock_movements')
        .where('fecha', '>=', from.toISOString())
        .select('kind')
        .sum('quantity as total')
        .count('* as count')
        .groupBy('kind')

      const byMovementType = await db('stock_movements')
        .where('fecha', '>=', from.toISOString())
        .whereNotNull('movement_type')
        .select('movement_type')
        .sum(db.raw('ABS(quantity) as total'))
        .count('* as count')
        .groupBy('movement_type')

      const topItems = await db('stock_movements as sm')
        .join('items as i', 'i.id', 'sm.item_id')
        .where('sm.fecha', '>=', from.toISOString())
        .select('i.id', 'i.name', 'i.code')
        .sum(db.raw('ABS(sm.quantity) as total'))
        .count('sm.id as movements')
        .groupBy('i.id', 'i.name', 'i.code')
        .orderBy('total', 'desc')
        .limit(10)

      return res.json({
        data: {
          byKind,
          byMovementType,
          topItems,
        }
      })
    } catch (err) {
      return next(err)
    }
  }
}

export const statisticsController = new StatisticsController()

