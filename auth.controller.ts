import { Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '../database/connection'
import { logger } from '../utils/logger'
import { AuthRequest } from '../middleware/auth.middleware'

export class AuthController {

  async login(req: Request, res: Response, next: NextFunction) {
    const { username, password } = req.body as { username: string; password: string }

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' })
    }

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
        process.env.JWT_SECRET!,
        { expiresIn: '12h' }
      )

      logger.info({ action: 'LOGIN_OK', userId: user.id, username, ip: req.ip })

      const { password_hash, ...safeUser } = user
      res.json({ token, user: safeUser })
    } catch (err) {
      next(err)
    }
  }

  async me(req: AuthRequest, res: Response) {
    res.json({ user: req.user })
  }
}

export const authController = new AuthController()
