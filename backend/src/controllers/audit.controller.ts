import { type Response, type NextFunction } from 'express'
import { type AuthRequest } from '../middleware/auth.middleware'
import { getAuditLogs } from '../services/audit.service'

export class AuditController {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { limit, page, action, entityType, search } = req.query as Record<string, string>
      const result = await getAuditLogs({
        limit: limit ? parseInt(limit, 10) : 100,
        page: page ? parseInt(page, 10) : 1,
        action,
        entityType,
        search,
      })
      return res.json(result)
    } catch (err) {
      return next(err)
    }
  }
}

export const auditController = new AuditController()
