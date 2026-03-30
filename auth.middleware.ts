import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { logger } from '../utils/logger'

export interface AuthRequest extends Request {
  user?: { id: string; username: string; role: string; full_name: string }
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticación requerido.' })
  }
  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any
    req.user = { id: payload.id, username: payload.username, role: payload.role, full_name: payload.full_name }
    next()
  } catch (err) {
    logger.warn({ action: 'AUTH_FAILED', ip: req.ip, error: (err as Error).message })
    return res.status(401).json({ error: 'Token inválido o expirado.' })
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No tiene permisos para realizar esta acción.' })
    }
    next()
  }
}
