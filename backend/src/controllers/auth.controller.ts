import { type Request, type Response, type NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { db } from '../database/connection'
import { logger } from '../utils/logger'
import { type AuthRequest } from '../middleware/auth.middleware'

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

function requireJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('Missing env var: JWT_SECRET')
  return secret
}

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' })
    }

    const { username, password } = parsed.data
    try {
      const user = await db('users')
        .where({ username, is_active: true })
        .select('id', 'username', 'email', 'full_name', 'role', 'password_hash')
        .first()

      if (!user) {
        logger.warn({ action: 'LOGIN_FAILED', username, ip: req.ip, reason: 'USER_NOT_FOUND' })
        return res.status(401).json({ error: 'Credenciales incorrectas.' })
      }

      const valid = await bcrypt.compare(password, user.password_hash)
      if (!valid) {
        logger.warn({ action: 'LOGIN_FAILED', username, ip: req.ip, reason: 'BAD_PASSWORD' })
        return res.status(401).json({ error: 'Credenciales incorrectas.' })
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
        requireJwtSecret(),
        { expiresIn: '12h' },
      )

      logger.info({ action: 'LOGIN_OK', userId: user.id, username, ip: req.ip })
      const { password_hash, ...safeUser } = user
      return res.json({ token, user: safeUser })
    } catch (err) {
      return next(err)
    }
  }

  async me(req: AuthRequest, res: Response) {
    return res.json({ user: req.user })
  }
}

export const authController = new AuthController()

