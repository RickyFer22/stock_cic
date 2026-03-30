import { db } from '../database/connection'
import { type AuthRequest } from '../middleware/auth.middleware'

export interface AuditEntry {
  userId?: string
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'IMPORT' | 'EXPORT'
  entityType: string
  entityId?: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  ip?: string
  userAgent?: string
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db('audit_log').insert({
      user_id: entry.userId || null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId || null,
      old_values: entry.oldValues ? JSON.stringify(entry.oldValues) : null,
      new_values: entry.newValues ? JSON.stringify(entry.newValues) : null,
      ip: entry.ip || null,
      user_agent: entry.userAgent || null,
    })
  } catch (err) {
    console.error('Failed to write audit log:', err)
  }
}

export function extractAuditInfo(req: AuthRequest): { userId?: string; ip?: string; userAgent?: string } {
  return {
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  }
}
