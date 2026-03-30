import { type Request, type Response, type NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { logger } from '../utils/logger'

export interface AuthUser {
  id: string
  username: string
  role: 'admin' | 'supervisor' | 'operador'
  full_name: string
}

export interface AuthRequest extends Request {
  user?: AuthUser
}

function requireJwtSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('Missing env var: JWT_SECRET')
  return secret
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticación requerido.' })
  }

  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, requireJwtSecret()) as any
    req.user = {
      id: payload.id,
      username: payload.username,
      role: payload.role,
      full_name: payload.full_name,
    }
    next()
  } catch (err) {
    logger.warn({ action: 'AUTH_FAILED', ip: req.ip, error: (err as Error).message })
    return res.status(401).json({ error: 'Token inválido o expirado.' })
  }
}

export function requireRole(...roles: Array<AuthUser['role']>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No tiene permisos para realizar esta acción.' })
    }
    next()
  }
}

