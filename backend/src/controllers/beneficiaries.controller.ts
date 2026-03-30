import { type Request, type Response, type NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { db } from '../database/connection'

const upsertSchema = z.object({
  dni: z.string().min(6).max(16),
  apellido: z.string().min(1),
  nombre: z.string().min(1),
  fecha_nacimiento: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  direccion: z.string().nullable().optional(),
  barrio: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
})

export class BeneficiariesController {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      const items = await db('beneficiaries')
        .where({ is_active: true })
        .select('id', 'dni', 'apellido', 'nombre', 'fecha_nacimiento', 'telefono', 'direccion', 'barrio', 'is_active')
        .orderBy('apellido')
        .limit(500)
      return res.json({ data: items, total: items.length })
    } catch (err) {
      return next(err)
    }
  }

  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const beneficiary = await db('beneficiaries').where({ id: req.params.id }).first()
      if (!beneficiary) return res.status(404).json({ error: 'Beneficiario no encontrado.' })
      return res.json({ data: beneficiary })
    } catch (err) {
      return next(err)
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    const parsed = upsertSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos.' })

    const payload = parsed.data
    try {
      const [beneficiary] = await db('beneficiaries')
        .insert({
          id: uuidv4(),
          dni: payload.dni,
          apellido: payload.apellido,
          nombre: payload.nombre,
          fecha_nacimiento: payload.fecha_nacimiento || null,
          telefono: payload.telefono || null,
          direccion: payload.direccion || null,
          barrio: payload.barrio || null,
          observaciones: payload.observaciones || null,
        })
        .returning(['id', 'dni', 'apellido', 'nombre', 'fecha_nacimiento', 'telefono', 'direccion', 'barrio'])
      return res.status(201).json({ data: beneficiary })
    } catch (err) {
      return next(err)
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    const parsed = upsertSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Datos inválidos.' })

    try {
      const [beneficiary] = await db('beneficiaries')
        .where({ id: req.params.id })
        .update(parsed.data)
        .returning('*')
      if (!beneficiary) return res.status(404).json({ error: 'Beneficiario no encontrado.' })
      return res.json({ data: beneficiary })
    } catch (err) {
      return next(err)
    }
  }
}

export const beneficiariesController = new BeneficiariesController()
