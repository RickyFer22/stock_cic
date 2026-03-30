import { type Response, type NextFunction } from 'express'
import ExcelJS from 'exceljs'
import { db } from '../database/connection'
import { logger } from '../utils/logger'
import { type AuthRequest } from '../middleware/auth.middleware'
import { logAudit, extractAuditInfo } from '../services/audit.service'

function asText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).trim()
}

function asInt(value: unknown): number | null {
  const raw = asText(value)
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return Math.trunc(n)
}

function asBool(value: unknown): boolean | null {
  const raw = asText(value).toLowerCase()
  if (!raw) return null
  if (['1', 'true', 'si', 'sí', 's', 'yes', 'y'].includes(raw)) return true
  if (['0', 'false', 'no', 'n'].includes(raw)) return false
  return null
}

function validateCode(code: string): boolean {
  return /^[A-Za-z0-9\-_]+$/.test(code)
}

function validateDNI(dni: string): boolean {
  const cleaned = dni.replace(/[.\-\s]/g, '')
  return /^\d{6,9}$/.test(cleaned)
}

function validateEmail(email: string): boolean {
  if (!email) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function filenameWithDate(prefix: string) {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${prefix}_${yyyy}${mm}${dd}.xlsx`
}

function toNodeBuffer(buf: unknown): any {
  // exceljs types vary across node versions; normalize to Node Buffer for Express.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyBuf = buf as any
  return Buffer.isBuffer(anyBuf) ? anyBuf : Buffer.from(anyBuf)
}

// Mapeo cabeceras español -> clave interna para importación
const ITEMS_HEADER_ES: Record<string, string> = {
  código: 'code',
  nombre: 'name',
  descripción: 'description',
  categoría: 'category',
  unidad: 'unit',
  'stock mínimo': 'stock_minimo',
  'stock máximo': 'stock_maximo',
  activo: 'is_active',
}

const BENEFICIARIES_HEADER_ES: Record<string, string> = {
  dni: 'dni',
  apellido: 'apellido',
  nombre: 'nombre',
  'fecha nacimiento': 'fecha_nacimiento',
  teléfono: 'telefono',
  dirección: 'direccion',
  barrio: 'barrio',
  observaciones: 'observaciones',
  activo: 'is_active',
}

export class ExcelController {
  async exportItems(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rows = await db('items as i')
        .leftJoin('categories as c', 'c.id', 'i.category_id')
        .select(
          'i.code',
          'i.name',
          'i.description',
          db.raw('COALESCE(c.name, \'\') as category'),
          'i.unit',
          'i.stock_minimo',
          'i.stock_maximo',
          'i.is_active',
        )
        .orderBy('i.name')

      const wb = new ExcelJS.Workbook()
      wb.creator = 'Municipalidad de San Roque'
      wb.created = new Date()

      const ws = wb.addWorksheet('Artículos')
      ws.columns = [
        { header: 'Código', key: 'code', width: 14 },
        { header: 'Nombre', key: 'name', width: 32 },
        { header: 'Descripción', key: 'description', width: 40 },
        { header: 'Categoría', key: 'category', width: 22 },
        { header: 'Unidad', key: 'unit', width: 14 },
        { header: 'Stock mínimo', key: 'stock_minimo', width: 14 },
        { header: 'Stock máximo', key: 'stock_maximo', width: 14 },
        { header: 'Activo', key: 'is_active', width: 10 },
      ]
      ws.getRow(1).font = { bold: true }

      for (const r of rows) ws.addRow(r)

      const buf = await wb.xlsx.writeBuffer()
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="${filenameWithDate('items_san_roque')}"`)
      return res.send(toNodeBuffer(buf))
    } catch (err) {
      return next(err)
    }
  }

  async importItems(req: AuthRequest, res: Response, next: NextFunction) {
    if (!req.user) return res.status(401).json({ error: 'No autenticado.' })
    const file = (req as any).file as Express.Multer.File | undefined
    if (!file) return res.status(400).json({ error: 'Archivo requerido (campo: file).' })

    const ip = req.ip
    const userId = req.user.id
    const auditInfo = extractAuditInfo(req)

    try {
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(file.buffer as any)
      const ws = wb.worksheets[0]
      if (!ws) return res.status(400).json({ error: 'El Excel no contiene hojas.' })

      const headerRow = ws.getRow(1)
      const headers = headerRow.values as any[]
      const headerIndex = new Map<string, number>()
      for (let i = 1; i < headers.length; i++) {
        const h = asText(headers[i]).toLowerCase().trim()
        if (!h) continue
        const canonical = ITEMS_HEADER_ES[h] || h
        headerIndex.set(canonical, i)
      }

      const get = (row: ExcelJS.Row, key: string) => {
        const idx = headerIndex.get(key)
        if (!idx) return ''
        return row.getCell(idx).value
      }

      const stats = { created: 0, updated: 0, skipped: 0, errors: [] as Array<{ row: number; error: string }> }

      const existingCodes = await db('items').select('code')
      const existingCodeSet = new Set(existingCodes.map(r => r.code))

      await db.transaction(async (trx) => {
        for (let rowNumber = 2; rowNumber <= ws.rowCount; rowNumber++) {
          const row = ws.getRow(rowNumber)
          const code = asText(get(row, 'code'))
          const name = asText(get(row, 'name'))
          if (!code || !name) {
            stats.skipped++
            stats.errors.push({ row: rowNumber, error: 'Código o nombre vacío' })
            continue
          }

          if (!validateCode(code)) {
            stats.skipped++
            stats.errors.push({ row: rowNumber, error: `Código inválido: ${code}` })
            continue
          }

          if (code.length > 50) {
            stats.skipped++
            stats.errors.push({ row: rowNumber, error: 'Código demasiado largo (máx 50 caracteres)' })
            continue
          }

          const description = asText(get(row, 'description')) || null
          const categoryName = asText(get(row, 'category'))
          const unit = asText(get(row, 'unit')) || 'unidad'
          const stock_minimo = asInt(get(row, 'stock_minimo'))
          const stock_maximo = asInt(get(row, 'stock_maximo'))
          const is_active = asBool(get(row, 'is_active'))

          if (stock_minimo !== null && stock_minimo < 0) {
            stats.skipped++
            stats.errors.push({ row: rowNumber, error: 'Stock mínimo no puede ser negativo' })
            continue
          }

          if (stock_maximo !== null && stock_maximo < 0) {
            stats.skipped++
            stats.errors.push({ row: rowNumber, error: 'Stock máximo no puede ser negativo' })
            continue
          }

          try {
            let category_id: string | null = null
            if (categoryName) {
              const existing = await trx('categories').where({ name: categoryName }).select('id').first()
              if (existing) category_id = existing.id
              else {
                const [created] = await trx('categories').insert({ name: categoryName }).returning(['id'])
                category_id = created.id
              }
            }

            const existingItem = await trx('items').where({ code }).select('id').first()
            if (existingItem) {
              await trx('items').where({ id: existingItem.id }).update({
                name,
                description,
                category_id,
                unit,
                ...(stock_minimo !== null && { stock_minimo }),
                ...(stock_maximo !== null && { stock_maximo }),
                ...(is_active !== null && { is_active }),
              })
              stats.updated++
            } else {
              await trx('items').insert({
                code,
                name,
                description,
                category_id,
                unit,
                stock_actual: 0,
                stock_minimo: stock_minimo ?? 0,
                stock_maximo: stock_maximo ?? null,
                is_active: is_active ?? true,
              })
              existingCodeSet.add(code)
              stats.created++
            }
          } catch (e) {
            stats.errors.push({ row: rowNumber, error: (e as Error).message })
          }
        }
      })

      await logAudit({
        ...auditInfo,
        action: 'IMPORT',
        entityType: 'items',
        newValues: { created: stats.created, updated: stats.updated, skipped: stats.skipped, errors: stats.errors.length },
      })

      logger.info({ action: 'EXCEL_IMPORT_ITEMS', userId, ip, ...stats })
      return res.json({ data: stats })
    } catch (err) {
      return next(err)
    }
  }

  async exportBeneficiaries(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rows = await db('beneficiaries')
        .select('dni', 'apellido', 'nombre', 'fecha_nacimiento', 'telefono', 'direccion', 'barrio', 'observaciones', 'is_active')
        .orderBy('apellido')

      const wb = new ExcelJS.Workbook()
      wb.creator = 'Municipalidad de San Roque'
      wb.created = new Date()

      const ws = wb.addWorksheet('Beneficiarios')
      ws.columns = [
        { header: 'DNI', key: 'dni', width: 14 },
        { header: 'Apellido', key: 'apellido', width: 20 },
        { header: 'Nombre', key: 'nombre', width: 20 },
        { header: 'Fecha nacimiento', key: 'fecha_nacimiento', width: 16 },
        { header: 'Teléfono', key: 'telefono', width: 16 },
        { header: 'Dirección', key: 'direccion', width: 30 },
        { header: 'Barrio', key: 'barrio', width: 18 },
        { header: 'Observaciones', key: 'observaciones', width: 40 },
        { header: 'Activo', key: 'is_active', width: 10 },
      ]
      ws.getRow(1).font = { bold: true }

      for (const r of rows) ws.addRow(r)

      const buf = await wb.xlsx.writeBuffer()
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="${filenameWithDate('beneficiarios_san_roque')}"`)
      return res.send(toNodeBuffer(buf))
    } catch (err) {
      return next(err)
    }
  }

  async importBeneficiaries(req: AuthRequest, res: Response, next: NextFunction) {
    if (!req.user) return res.status(401).json({ error: 'No autenticado.' })
    const file = (req as any).file as Express.Multer.File | undefined
    if (!file) return res.status(400).json({ error: 'Archivo requerido (campo: file).' })

    const ip = req.ip
    const userId = req.user.id
    const auditInfo = extractAuditInfo(req)

    try {
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(file.buffer as any)
      const ws = wb.worksheets[0]
      if (!ws) return res.status(400).json({ error: 'El Excel no contiene hojas.' })

      const headerRow = ws.getRow(1)
      const headers = headerRow.values as any[]
      const headerIndex = new Map<string, number>()
      for (let i = 1; i < headers.length; i++) {
        const h = asText(headers[i]).toLowerCase().trim()
        if (!h) continue
        const canonical = BENEFICIARIES_HEADER_ES[h] || h
        headerIndex.set(canonical, i)
      }

      const get = (row: ExcelJS.Row, key: string) => {
        const idx = headerIndex.get(key)
        if (!idx) return ''
        return row.getCell(idx).value
      }

      const stats = { created: 0, updated: 0, skipped: 0, errors: [] as Array<{ row: number; error: string }> }

      await db.transaction(async (trx) => {
        for (let rowNumber = 2; rowNumber <= ws.rowCount; rowNumber++) {
          const row = ws.getRow(rowNumber)
          const dni = asText(get(row, 'dni'))
          const apellido = asText(get(row, 'apellido'))
          const nombre = asText(get(row, 'nombre'))
          if (!dni || !apellido || !nombre) {
            stats.skipped++
            stats.errors.push({ row: rowNumber, error: 'DNI, apellido o nombre vacío' })
            continue
          }

          if (!validateDNI(dni)) {
            stats.skipped++
            stats.errors.push({ row: rowNumber, error: `DNI inválido: ${dni}` })
            continue
          }

          const fecha_nacimiento = asText(get(row, 'fecha_nacimiento')) || null
          const telefono = asText(get(row, 'telefono')) || null
          const direccion = asText(get(row, 'direccion')) || null
          const barrio = asText(get(row, 'barrio')) || null
          const observaciones = asText(get(row, 'observaciones')) || null
          const is_active = asBool(get(row, 'is_active'))

          try {
            const existing = await trx('beneficiaries').where({ dni }).select('id').first()
            if (existing) {
              await trx('beneficiaries').where({ id: existing.id }).update({
                apellido,
                nombre,
                fecha_nacimiento,
                telefono,
                direccion,
                barrio,
                observaciones,
                ...(is_active !== null && { is_active }),
              })
              stats.updated++
            } else {
              await trx('beneficiaries').insert({
                dni,
                apellido,
                nombre,
                fecha_nacimiento,
                telefono,
                direccion,
                barrio,
                observaciones,
                is_active: is_active ?? true,
              })
              stats.created++
            }
          } catch (e) {
            stats.errors.push({ row: rowNumber, error: (e as Error).message })
          }
        }
      })

      await logAudit({
        ...auditInfo,
        action: 'IMPORT',
        entityType: 'beneficiaries',
        newValues: { created: stats.created, updated: stats.updated, skipped: stats.skipped, errors: stats.errors.length },
      })

      logger.info({ action: 'EXCEL_IMPORT_BENEFICIARIES', userId, ip, ...stats })
      return res.json({ data: stats })
    } catch (err) {
      return next(err)
    }
  }

  async exportInventoryHealth(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const hasExpiryDateColumn = await db('information_schema.columns')
        .where({
          table_schema: 'public',
          table_name: 'items',
          column_name: 'expiry_date',
        })
        .first()

      const lowStockItems = await db('items as i')
        .leftJoin('categories as c', 'c.id', 'i.category_id')
        .whereRaw('i.stock_actual <= i.stock_minimo AND i.stock_actual > 0 AND i.is_active = true')
        .orderBy('i.stock_actual', 'asc')
        .select(
          'i.code',
          'i.name',
          'i.stock_actual',
          'i.stock_minimo',
          'i.stock_maximo',
          'i.unit',
          ...(hasExpiryDateColumn ? ['i.expiry_date'] : []),
          db.raw('COALESCE(c.name, \'\') as category'),
        )

      const outOfStockItems = await db('items as i')
        .leftJoin('categories as c', 'c.id', 'i.category_id')
        .whereRaw('i.stock_actual = 0 AND i.is_active = true')
        .orderBy('i.name', 'asc')
        .select(
          'i.code',
          'i.name',
          'i.stock_actual',
          'i.stock_minimo',
          'i.stock_maximo',
          'i.unit',
          ...(hasExpiryDateColumn ? ['i.expiry_date'] : []),
          db.raw('COALESCE(c.name, \'\') as category'),
        )

      const expiringItems = hasExpiryDateColumn
        ? await db('items as i')
            .leftJoin('categories as c', 'c.id', 'i.category_id')
            .whereRaw("i.expiry_date IS NOT NULL AND i.expiry_date <= CURRENT_DATE + interval '30 days' AND i.expiry_date >= CURRENT_DATE AND i.is_active = true")
            .orderBy('i.expiry_date', 'asc')
            .select(
              'i.code',
              'i.name',
              'i.stock_actual',
              'i.stock_minimo',
              'i.stock_maximo',
              'i.unit',
              'i.expiry_date',
              db.raw('COALESCE(c.name, \'\') as category'),
            )
        : []

      const wb = new ExcelJS.Workbook()
      wb.creator = 'Municipalidad de San Roque'
      wb.created = new Date()

      const ws = wb.addWorksheet('Estado de Stock')
      ws.columns = [
        { header: 'Estado', key: 'status', width: 18 },
        { header: 'Código', key: 'code', width: 14 },
        { header: 'Nombre', key: 'name', width: 32 },
        { header: 'Categoría', key: 'category', width: 22 },
        { header: 'Unidad', key: 'unit', width: 10 },
        { header: 'Stock actual', key: 'stock_actual', width: 14 },
        { header: 'Stock mínimo', key: 'stock_minimo', width: 14 },
        { header: 'Stock máximo', key: 'stock_maximo', width: 14 },
        ...(hasExpiryDateColumn ? [{ header: 'Fecha vencimiento', key: 'expiry_date', width: 16 }] : []),
      ]
      ws.getRow(1).font = { bold: true }

      for (const r of lowStockItems) {
        ws.addRow({
          status: 'Bajo stock',
          ...r,
          ...(hasExpiryDateColumn && (r as any).expiry_date
            ? { expiry_date: (r as any).expiry_date.toISOString().slice(0, 10) }
            : {}),
        })
      }
      for (const r of outOfStockItems) {
        ws.addRow({
          status: 'Sin stock',
          ...r,
          ...(hasExpiryDateColumn && (r as any).expiry_date
            ? { expiry_date: (r as any).expiry_date.toISOString().slice(0, 10) }
            : {}),
        })
      }
      for (const r of expiringItems) {
        ws.addRow({
          status: 'Por vencer',
          ...r,
          ...(hasExpiryDateColumn && (r as any).expiry_date
            ? { expiry_date: (r as any).expiry_date.toISOString().slice(0, 10) }
            : {}),
        })
      }

      const buf = await wb.xlsx.writeBuffer()
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="${filenameWithDate('estado_stock_san_roque')}"`)
      return res.send(toNodeBuffer(buf))
    } catch (err) {
      return next(err)
    }
  }

  async exportMovements(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { kind, from, to } = req.query as Record<string, string | undefined>

      const query = db('stock_movements as sm')
        .join('items as i', 'i.id', 'sm.item_id')
        .join('users as u', 'u.id', 'sm.user_id')
        .select(
          'sm.fecha',
          'sm.kind',
          'sm.movement_type',
          'sm.quantity',
          'sm.counterparty',
          'sm.notes',
          'i.code as item_code',
          'i.name as item_name',
          'i.unit',
          'u.full_name as operador',
        )
        .orderBy('sm.fecha', 'desc')

      if (kind) {
        const normalizedKind = kind === 'OUTBOUND' ? 'DISTRIBUTION' : kind
        query.where('sm.kind', normalizedKind)
      }

      if (from) {
        query.where('sm.fecha', '>=', from)
      }
      if (to) {
        query.where('sm.fecha', '<=', to)
      }

      const rows = await query.limit(5000)

      const wb = new ExcelJS.Workbook()
      wb.creator = 'Municipalidad de San Roque'
      wb.created = new Date()

      const ws = wb.addWorksheet('Movimientos')
      ws.columns = [
        { header: 'Fecha', key: 'fecha', width: 20 },
        { header: 'Tipo movimiento', key: 'kindLabel', width: 18 },
        { header: 'Detalle', key: 'movementTypeLabel', width: 22 },
        { header: 'Destino / Contraparte', key: 'counterparty', width: 26 },
        { header: 'Notas', key: 'notes', width: 40 },
        { header: 'Código artículo', key: 'item_code', width: 16 },
        { header: 'Nombre artículo', key: 'item_name', width: 32 },
        { header: 'Unidad', key: 'unit', width: 10 },
        { header: 'Cantidad', key: 'quantity', width: 12 },
        { header: 'Operador', key: 'operador', width: 24 },
      ]
      ws.getRow(1).font = { bold: true }

      const kindLabels: Record<string, string> = {
        INGRESO: 'Ingreso',
        DISTRIBUTION: 'Egreso',
        OUTBOUND: 'Egreso',
        ADJUSTMENT: 'Ajuste',
      }
      const movementTypeLabels: Record<string, string> = {
        delivery: 'Entrega',
        transfer_out: 'Transferencia',
        waste: 'Descarte',
        adjustment: 'Ajuste',
        donation: 'Donación',
        purchase: 'Compra',
        transfer_in: 'Transferencia entrante',
      }

      for (const r of rows) {
        const row = r as any
        ws.addRow({
          fecha: row.fecha instanceof Date ? row.fecha.toISOString() : row.fecha,
          kindLabel: kindLabels[row.kind] || row.kind,
          movementTypeLabel: row.movement_type ? (movementTypeLabels[row.movement_type] || row.movement_type) : '',
          counterparty: row.counterparty,
          notes: row.notes,
          item_code: row.item_code,
          item_name: row.item_name,
          unit: row.unit,
          quantity: row.quantity,
          operador: row.operador,
        })
      }

      const buf = await wb.xlsx.writeBuffer()
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="${filenameWithDate('movimientos_san_roque')}"`)
      return res.send(toNodeBuffer(buf))
    } catch (err) {
      return next(err)
    }
  }
}

export const excelController = new ExcelController()
