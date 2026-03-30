import { type Request, type Response, type NextFunction } from 'express'
import { logger } from '../utils/logger'

export function errorMiddleware(err: any, req: Request, res: Response, _next: NextFunction) {
  const status = err?.status || err?.statusCode || 500
  const message = err?.message || 'Error interno del servidor'

  logger.error({
    action: 'UNHANDLED_ERROR',
    status,
    message,
    path: req.path,
    method: req.method,
    ip: req.ip,
    stack: process.env.NODE_ENV !== 'production' ? err?.stack : undefined,
  })

  // PostgreSQL: unique_violation
  if (err?.code === '23505') {
    return res.status(409).json({ error: 'Ya existe un registro con ese valor único (duplicado).' })
  }

  // PostgreSQL: foreign_key_violation
  if (err?.code === '23503') {
    return res.status(409).json({ error: 'No se puede eliminar/actualizar: existen registros relacionados.' })
  }

  // PostgreSQL: check_violation
  if (err?.code === '23514' || err?.code === 'check_violation') {
    return res.status(422).json({ error: message })
  }

  return res.status(status).json({
    error: process.env.NODE_ENV === 'production' && status === 500
      ? 'Error interno del servidor. Contacte al administrador.'
      : message,
  })
}

