import { type Response, type NextFunction } from 'express'
import { db } from '../database/connection'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { logger } from '../utils/logger'
import { type AuthRequest } from '../middleware/auth.middleware'
import bcrypt from 'bcryptjs'

const userSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100).optional(),
  full_name: z.string().max(100),
  email: z.string().email().optional().or(z.literal('')),
  role: z.enum(['admin', 'supervisor', 'operador']),
  is_active: z.boolean().default(true),
})

export class UsersController {
  async list(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rows = await db('users')
        .select('id', 'username', 'full_name', 'email', 'role', 'is_active', 'created_at')
        .orderBy('full_name', 'asc')
      return res.json({ data: rows })
    } catch (err) {
      return next(err)
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    const parsed = userSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Datos de usuario inválidos.' })
    
    if (!parsed.data.password) {
      return res.status(400).json({ error: 'La contraseña es requerida para nuevos usuarios.' })
    }

    try {
      const existing = await db('users').where({ username: parsed.data.username }).first()
      if (existing) {
        return res.status(409).json({ error: 'El nombre de usuario ya está en uso.' })
      }

      const id = uuidv4()
      const password_hash = await bcrypt.hash(parsed.data.password, 10)

      await db('users').insert({
        id,
        username: parsed.data.username,
        password_hash,
        full_name: parsed.data.full_name,
        email: parsed.data.email || null,
        role: parsed.data.role,
        is_active: parsed.data.is_active,
      })

      logger.info({ action: 'USER_CREATED', adminId: req.user?.id, targetUserId: id })
      return res.status(201).json({ data: { id } })
    } catch (err) {
      return next(err)
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    const parsed = userSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Datos de usuario inválidos.' })
    
    const id = req.params.id

    try {
      const user = await db('users').where({ id }).first()
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' })

      const updates: any = {
        username: parsed.data.username,
        full_name: parsed.data.full_name,
        email: parsed.data.email || null,
        role: parsed.data.role,
        is_active: parsed.data.is_active,
      }

      if (parsed.data.password) {
        updates.password_hash = await bcrypt.hash(parsed.data.password, 10)
      }

      await db('users').where({ id }).update(updates)

      logger.info({ action: 'USER_UPDATED', adminId: req.user?.id, targetUserId: id })
      return res.json({ data: { success: true } })
    } catch (err) {
      return next(err)
    }
  }
}

export const usersController = new UsersController()
