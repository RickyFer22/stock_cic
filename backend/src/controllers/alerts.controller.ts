import { type Response, type NextFunction } from 'express'
import { db } from '../database/connection'
import { type AuthRequest } from '../middleware/auth.middleware'

type AlertType = 'low_stock' | 'expiry_30_days' | 'expiry_15_days' | 'expiry_7_days' | 'expired'

function classifyExpiry(days: number): AlertType | null {
  if (days < 0) return 'expired'
  if (days <= 7) return 'expiry_7_days'
  if (days <= 15) return 'expiry_15_days'
  if (days <= 30) return 'expiry_30_days'
  return null
}

export class AlertsController {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ackRows = await db('alert_acknowledgements').select('item_id', 'alert_type')
      const ack = new Set(ackRows.map((r: any) => `${r.item_id}:${r.alert_type}`))

      const lowStockItems = await db('items as i')
        .leftJoin('categories as c', 'c.id', 'i.category_id')
        .where('i.is_active', true)
        .andWhere('i.stock_actual', '<=', db.ref('i.stock_minimo'))
        .select(
          'i.id',
          'i.code',
          'i.name',
          'i.stock_actual',
          'i.stock_minimo',
          'i.location',
          'i.expiry_date',
          'c.name as category',
        )
        .orderBy('i.stock_actual', 'asc')

      const expiryItems = await db('items as i')
        .leftJoin('categories as c', 'c.id', 'i.category_id')
        .where('i.is_active', true)
        .whereNotNull('i.expiry_date')
        .select(
          'i.id',
          'i.code',
          'i.name',
          'i.location',
          'i.expiry_date',
          'i.stock_actual',
          'c.name as category',
        )

      const today = new Date()
      const toDateOnly = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
      const todayUTC = toDateOnly(today)

      const computed: Array<any> = []

      for (const it of lowStockItems as any[]) {
        const key = `${it.id}:low_stock`
        if (ack.has(key)) continue
        computed.push({
          type: 'low_stock' as AlertType,
          severity: 'high',
          message: `Stock bajo: ${it.stock_actual} (min ${it.stock_minimo})`,
          item: it,
        })
      }

      for (const it of expiryItems as any[]) {
        const expiry = new Date(it.expiry_date)
        const expiryUTC = toDateOnly(expiry)
        const diffMs = expiryUTC.getTime() - todayUTC.getTime()
        const days = Math.floor(diffMs / (24 * 60 * 60 * 1000))
        const t = classifyExpiry(days)
        if (!t) continue
        const key = `${it.id}:${t}`
        if (ack.has(key)) continue
        computed.push({
          type: t,
          severity: t === 'expired' ? 'high' : t === 'expiry_7_days' ? 'high' : t === 'expiry_15_days' ? 'medium' : 'low',
          message: t === 'expired'
            ? `Producto vencido (venció hace ${Math.abs(days)} día(s))`
            : `Vencimiento en ${days} día(s)`,
          days_to_expiry: days,
          item: it,
        })
      }

      computed.sort((a, b) => {
        const sev = (s: string) => (s === 'high' ? 0 : s === 'medium' ? 1 : 2)
        return sev(a.severity) - sev(b.severity)
      })

      return res.json({ data: computed })
    } catch (err) {
      return next(err)
    }
  }

  async acknowledge(req: AuthRequest, res: Response, next: NextFunction) {
    if (!req.user) return res.status(401).json({ error: 'No autenticado.' })
    const itemId = req.params.itemId
    const alertType = req.params.type as AlertType
    if (!['low_stock', 'expiry_30_days', 'expiry_15_days', 'expiry_7_days', 'expired'].includes(alertType)) {
      return res.status(400).json({ error: 'Tipo de alerta inválido.' })
    }

    try {
      await db('alert_acknowledgements')
        .insert({
          item_id: itemId,
          alert_type: alertType,
          acknowledged_by: req.user.id,
        })
        .onConflict(['item_id', 'alert_type'])
        .merge({ acknowledged_at: db.fn.now(), acknowledged_by: req.user.id })

      return res.json({ ok: true })
    } catch (err) {
      return next(err)
    }
  }
}

export const alertsController = new AlertsController()

