import { Request, Response, NextFunction } from 'express'
import { db } from '../database/connection'
import { v4 as uuidv4 } from 'uuid'

export class BeneficiariesController {

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await db('beneficiaries')
        .where({ is_active: true })
        .select('id','dni','apellido','nombre','fecha_nacimiento','telefono','direccion','barrio','is_active')
        .orderBy('apellido')
        .limit(500)
      res.json({ data: items, total: items.length })
    } catch (err) { next(err) }
  }

  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const b = await db('beneficiaries').where({ id: req.params.id }).first()
      if (!b) return res.status(404).json({ error: 'Beneficiario no encontrado.' })
      res.json({ data: b })
    } catch (err) { next(err) }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    const { dni, apellido, nombre, fecha_nacimiento, telefono, direccion, barrio, observaciones } = req.body
    if (!dni || !apellido || !nombre) {
      return res.status(400).json({ error: 'dni, apellido y nombre son requeridos.' })
    }
    try {
      const [b] = await db('beneficiaries').insert({
        id: uuidv4(), dni, apellido, nombre,
        fecha_nacimiento: fecha_nacimiento || null,
        telefono: telefono || null,
        direccion: direccion || null,
        barrio: barrio || null,
        observaciones: observaciones || null,
      }).returning('id','dni','apellido','nombre','fecha_nacimiento','telefono','direccion','barrio')
      res.status(201).json({ data: b })
    } catch (err) { next(err) }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    const { dni, apellido, nombre, fecha_nacimiento, telefono, direccion, barrio, observaciones, is_active } = req.body
    try {
      const [b] = await db('beneficiaries')
        .where({ id: req.params.id })
        .update({ dni, apellido, nombre, fecha_nacimiento: fecha_nacimiento || null,
          telefono: telefono || null, direccion: direccion || null,
          barrio: barrio || null, observaciones: observaciones || null,
          ...(is_active !== undefined && { is_active }),
        }).returning('*')
      if (!b) return res.status(404).json({ error: 'Beneficiario no encontrado.' })
      res.json({ data: b })
    } catch (err) { next(err) }
  }
}

export const beneficiariesController = new BeneficiariesController()
