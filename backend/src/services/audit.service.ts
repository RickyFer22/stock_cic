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

export async function ensureAuditTableExists(): Promise<void> {
  try {
    const exists = await db.schema.hasTable('audit_log')
    if (!exists) {
      await db.raw(`
        CREATE TABLE IF NOT EXISTS audit_log (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          timestamp timestamptz NOT NULL DEFAULT now(),
          user_id uuid REFERENCES users(id) ON DELETE SET NULL,
          action text NOT NULL,
          entity_type text NOT NULL,
          entity_id uuid,
          old_values jsonb,
          new_values jsonb,
          ip inet,
          user_agent text
        );
        CREATE INDEX IF NOT EXISTS audit_log_timestamp_idx ON audit_log (timestamp DESC);
        CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log (entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS audit_log_user_idx ON audit_log (user_id);
      `)
      console.log('Tabla audit_log verificada/creada correctamente.')
    }
  } catch (err) {
    console.error('Error verificando tabla audit_log:', err)
  }
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

export async function getAuditLogs(options?: {
  limit?: number
  page?: number
  action?: string
  entityType?: string
  search?: string
}) {
  const limit = options?.limit || 100
  const page = options?.page || 1
  const offset = (page - 1) * limit

  let query = db('audit_log as al')
    .leftJoin('users as u', 'u.id', 'al.user_id')
    .select(
      'al.id',
      'al.timestamp',
      'al.action',
      'al.entity_type',
      'al.entity_id',
      'al.old_values',
      'al.new_values',
      'al.ip',
      'al.user_agent',
      'u.username',
      'u.full_name as user_full_name'
    )

  if (options?.action) {
    query = query.where('al.action', options.action)
  }

  if (options?.entityType) {
    query = query.where('al.entity_type', options.entityType)
  }

  if (options?.search) {
    const needle = `%${options.search}%`
    query = query.where((builder) => {
      builder
        .whereILike('u.full_name', needle)
        .orWhereILike('u.username', needle)
        .orWhereILike('al.entity_type', needle)
        .orWhereILike('al.action', needle)
    })
  }

  const [totalCountResult] = await db('audit_log').count('* as count')
  const total = Number(totalCountResult?.count || 0)

  const data = await query
    .orderBy('al.timestamp', 'desc')
    .limit(limit)
    .offset(offset)

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  }
}

