import { type Request, type Response, type NextFunction } from 'express'
import { db } from '../database/connection'

/**
 * Soporte: buzón de consultas del personal municipal al área de Modernización.
 * Solo recibe consultas de Stock CIC; los demás sistemas tienen el suyo.
 */

export const ESTADOS = [
  'Sin asignar',
  'En análisis',
  'Pendiente de información',
  'En proceso',
  'Resuelto',
  'Cerrado',
  'Reabierto',
] as const

export const PRIORIDADES = ['Baja', 'Normal', 'Alta', 'Crítica'] as const

export const CATEGORIAS = [
  'No puedo cargar un movimiento',
  'Datos incorrectos',
  'No puedo ingresar al sistema',
  'Pedido de cambio o mejora',
  'Consulta de uso',
  'Otro',
] as const

/**
 * Horas hábiles hasta la primera respuesta comprometida. Se cuentan sobre el
 * horario declarado de atención (lunes a viernes de 7 a 13), no sobre horas
 * corridas: un ticket abierto un viernes a las 12:50 no puede figurar como
 * vencido el lunes a las 8.
 */
const HORAS_COMPROMISO: Record<string, number> = {
  'Crítica': 2,
  'Alta': 6,   // un día hábil
  'Normal': 18, // tres días hábiles
  'Baja': 30,  // cinco días hábiles
}

const INICIO_JORNADA = 7
const FIN_JORNADA = 13

/** Suma horas hábiles a partir de un instante, respetando el horario de atención. */
export function sumarHorasHabiles(desde: Date, horas: number): Date {
  const d = new Date(desde)
  let restantes = horas

  while (restantes > 0) {
    const dia = d.getDay()
    // Fin de semana: saltar al lunes a la hora de apertura.
    if (dia === 0 || dia === 6) {
      d.setDate(d.getDate() + (dia === 0 ? 1 : 2))
      d.setHours(INICIO_JORNADA, 0, 0, 0)
      continue
    }
    if (d.getHours() < INICIO_JORNADA) d.setHours(INICIO_JORNADA, 0, 0, 0)
    if (d.getHours() >= FIN_JORNADA) {
      d.setDate(d.getDate() + 1)
      d.setHours(INICIO_JORNADA, 0, 0, 0)
      continue
    }
    const disponibles = FIN_JORNADA - d.getHours() - d.getMinutes() / 60
    if (restantes <= disponibles) {
      d.setTime(d.getTime() + restantes * 3600_000)
      restantes = 0
    } else {
      restantes -= disponibles
      d.setDate(d.getDate() + 1)
      d.setHours(INICIO_JORNADA, 0, 0, 0)
    }
  }
  return d
}

function actor(req: Request) {
  return (req as any).user
}

/** Quienes atienden soporte ven todo; el resto, solo lo propio. */
function esSoporte(req: Request): boolean {
  const rol = actor(req)?.role
  return rol === 'admin' || rol === 'supervisor'
}

async function registrarEvento(
  ticketId: string,
  tipo: string,
  anterior: string | null,
  nuevo: string | null,
  actorId: string,
) {
  await db('support_events').insert({
    ticket_id: ticketId,
    tipo,
    valor_anterior: anterior,
    valor_nuevo: nuevo,
    actor_id: actorId,
  })
}

export class SupportController {
  /** Catálogos para poblar los selectores sin duplicar las listas en el frontend. */
  async meta(_req: Request, res: Response) {
    return res.json({ data: { estados: ESTADOS, prioridades: PRIORIDADES, categorias: CATEGORIAS } })
  }

  /**
   * Bandeja. Filtra y pagina en el servidor: antes traía la tabla completa sin
   * límite y la recorría en el cliente.
   */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { estado, prioridad, asignado, categoria, q, vista } = req.query as Record<string, string>
      const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1)
      const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '25'), 10) || 25))

      const base = db('support_tickets as t')
      // Sin este filtro, todo el personal leía las consultas de todo el personal.
      if (!esSoporte(req)) base.where('t.user_id', actor(req).id)

      if (estado && estado !== 'todos') base.where('t.estado', estado)
      if (prioridad && prioridad !== 'todas') base.where('t.prioridad', prioridad)
      if (categoria && categoria !== 'todas') base.where('t.categoria', categoria)
      if (asignado === 'sin_asignar') base.whereNull('t.asignado_a')
      else if (asignado === 'mios') base.where('t.asignado_a', actor(req).id)
      else if (asignado) base.where('t.asignado_a', asignado)

      if (vista === 'abiertos') base.whereNotIn('t.estado', ['Cerrado'])
      else if (vista === 'vencidos') {
        base.whereNull('t.primera_respuesta_en').whereNotNull('t.vence_en').where('t.vence_en', '<', db.fn.now())
      } else if (vista === 'creados_por_mi') base.where('t.user_id', actor(req).id)

      if (q && q.trim()) {
        const needle = `%${q.trim()}%`
        base.where((b) => {
          b.whereILike('t.titulo', needle).orWhereILike('t.consulta', needle)
          const n = parseInt(q.trim(), 10)
          if (!isNaN(n)) b.orWhere('t.numero', n)
        })
      }

      const [{ count }] = await base.clone().count('t.id as count') as any
      const total = Number(count)

      const rows = await base
        .clone()
        .leftJoin('users as autor', 'autor.id', 't.user_id')
        .leftJoin('users as resp', 'resp.id', 't.asignado_a')
        .select(
          't.id', 't.numero', 't.titulo', 't.consulta', 't.estado', 't.prioridad',
          't.categoria', 't.created_at', 't.updated_at', 't.vence_en',
          't.primera_respuesta_en', 't.asignado_a',
          'autor.full_name as solicitante',
          'resp.full_name as responsable',
        )
        .orderBy('t.created_at', 'desc')
        .limit(limit)
        .offset((page - 1) * limit)

      // Contadores por estado, para las pestañas de la bandeja.
      const contadores = await base.clone().select('t.estado').count('t.id as count').groupBy('t.estado')

      return res.json({
        data: rows,
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        contadores: Object.fromEntries(contadores.map((r: any) => [r.estado, Number(r.count)])),
      })
    } catch (err) {
      return next(err)
    }
  }

  /** Detalle con mensajes e historial. Las notas internas no salen al solicitante. */
  async getOne(req: Request, res: Response, next: NextFunction) {
    try {
      const ticket = await db('support_tickets as t')
        .leftJoin('users as autor', 'autor.id', 't.user_id')
        .leftJoin('users as resp', 'resp.id', 't.asignado_a')
        .where('t.id', req.params.id)
        .select('t.*', 'autor.full_name as solicitante', 'resp.full_name as responsable')
        .first()

      if (!ticket) return res.status(404).json({ error: 'Consulta no encontrada.' })
      if (!esSoporte(req) && ticket.user_id !== actor(req).id) {
        return res.status(403).json({ error: 'No tiene permisos para ver esta consulta.' })
      }

      const mensajes = await db('support_messages as m')
        .leftJoin('users as u', 'u.id', 'm.autor_id')
        .where('m.ticket_id', ticket.id)
        .modify((qb) => { if (!esSoporte(req)) qb.where('m.visibilidad', 'visible') })
        .select('m.id', 'm.cuerpo', 'm.visibilidad', 'm.created_at', 'm.autor_id', 'u.full_name as autor')
        .orderBy('m.created_at', 'asc')

      const eventos = await db('support_events as e')
        .leftJoin('users as u', 'u.id', 'e.actor_id')
        .where('e.ticket_id', ticket.id)
        .select('e.tipo', 'e.valor_anterior', 'e.valor_nuevo', 'e.created_at', 'u.full_name as actor')
        .orderBy('e.created_at', 'asc')

      return res.json({ data: { ...ticket, mensajes, eventos } })
    } catch (err) {
      return next(err)
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { titulo, consulta, categoria } = req.body

      if (!titulo || !String(titulo).trim()) {
        return res.status(400).json({ error: 'Indicá un título breve para la consulta.' })
      }
      if (!consulta || String(consulta).trim().length < 15) {
        return res.status(400).json({ error: 'Contanos un poco más: la descripción necesita al menos 15 caracteres.' })
      }
      const cat = CATEGORIAS.includes(categoria) ? categoria : 'Otro'

      // La prioridad la fija soporte al tomar el caso, no quien abre la consulta:
      // si la elige el solicitante, todo entra como urgente y deja de informar.
      const prioridad = 'Normal'
      const ahora = new Date()

      const [ticket] = await db('support_tickets')
        .insert({
          user_id: actor(req).id,
          titulo: String(titulo).trim().slice(0, 120),
          consulta: String(consulta).trim(),
          categoria: cat,
          prioridad,
          estado: 'Sin asignar',
          vence_en: sumarHorasHabiles(ahora, HORAS_COMPROMISO[prioridad]),
        })
        .returning('*')

      await registrarEvento(ticket.id, 'creacion', null, 'Sin asignar', actor(req).id)

      return res.status(201).json({ data: ticket })
    } catch (err) {
      return next(err)
    }
  }

  /**
   * Agrega un mensaje. Lo puede usar quien abrió la consulta además de soporte:
   * antes la caja de respuesta se mostraba a todos pero el único endpoint exigía
   * admin, así que el solicitante recibía un error al enviar.
   */
  async addMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const { cuerpo, visibilidad } = req.body
      if (!cuerpo || !String(cuerpo).trim()) {
        return res.status(400).json({ error: 'El mensaje no puede estar vacío.' })
      }

      const ticket = await db('support_tickets').where({ id: req.params.id }).first()
      if (!ticket) return res.status(404).json({ error: 'Consulta no encontrada.' })

      const soporte = esSoporte(req)
      if (!soporte && ticket.user_id !== actor(req).id) {
        return res.status(403).json({ error: 'No tiene permisos para responder esta consulta.' })
      }
      // Solo soporte puede dejar notas internas; si no, el mensaje es visible.
      const vis = soporte && visibilidad === 'interna' ? 'interna' : 'visible'

      const [mensaje] = await db('support_messages')
        .insert({
          ticket_id: ticket.id,
          autor_id: actor(req).id,
          cuerpo: String(cuerpo).trim(),
          visibilidad: vis,
        })
        .returning('*')

      const cambios: any = { updated_at: db.fn.now() }
      if (vis === 'visible') cambios.ultimo_mensaje = String(cuerpo).trim().slice(0, 200)
      // La primera respuesta visible de soporte detiene el reloj de compromiso.
      if (soporte && vis === 'visible' && !ticket.primera_respuesta_en) {
        cambios.primera_respuesta_en = db.fn.now()
      }
      await db('support_tickets').where({ id: ticket.id }).update(cambios)

      return res.status(201).json({ data: mensaje })
    } catch (err) {
      return next(err)
    }
  }

  /** Cambio de estado y asignación, con registro en el historial. */
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { estado, prioridad, asignado_a } = req.body
      const ticket = await db('support_tickets').where({ id: req.params.id }).first()
      if (!ticket) return res.status(404).json({ error: 'Consulta no encontrada.' })

      const soporte = esSoporte(req)
      const esAutor = ticket.user_id === actor(req).id

      // El solicitante solo puede reabrir una consulta resuelta o cerrada.
      if (!soporte) {
        if (!esAutor || estado !== 'Reabierto' || !['Resuelto', 'Cerrado'].includes(ticket.estado)) {
          return res.status(403).json({ error: 'No tiene permisos para modificar esta consulta.' })
        }
      }

      const cambios: any = { updated_at: db.fn.now() }

      if (estado && estado !== ticket.estado) {
        if (!ESTADOS.includes(estado)) {
          return res.status(400).json({ error: `Estado inválido. Valores admitidos: ${ESTADOS.join(', ')}.` })
        }
        cambios.estado = estado
        if (estado === 'Resuelto') cambios.resuelto_en = db.fn.now()
        if (estado === 'Cerrado') cambios.cerrado_en = db.fn.now()
        if (estado === 'Reabierto') { cambios.resuelto_en = null; cambios.cerrado_en = null }
        await registrarEvento(ticket.id, 'estado', ticket.estado, estado, actor(req).id)
      }

      if (soporte && prioridad && prioridad !== ticket.prioridad) {
        if (!PRIORIDADES.includes(prioridad)) {
          return res.status(400).json({ error: `Prioridad inválida. Valores admitidos: ${PRIORIDADES.join(', ')}.` })
        }
        cambios.prioridad = prioridad
        // Recalcular el compromiso solo si todavía no hubo primera respuesta.
        if (!ticket.primera_respuesta_en) {
          cambios.vence_en = sumarHorasHabiles(new Date(ticket.created_at), HORAS_COMPROMISO[prioridad])
        }
        await registrarEvento(ticket.id, 'prioridad', ticket.prioridad, prioridad, actor(req).id)
      }

      // 'yo' permite tomar el caso sin que el frontend tenga que conocer el UUID
      // del usuario en sesión.
      const destino = asignado_a === 'yo' ? actor(req).id : asignado_a

      if (soporte && destino !== undefined && destino !== ticket.asignado_a) {
        cambios.asignado_a = destino || null
        if (!cambios.estado && ticket.estado === 'Sin asignar' && destino) cambios.estado = 'En análisis'
        const antes = ticket.asignado_a
          ? (await db('users').where({ id: ticket.asignado_a }).first())?.full_name ?? null
          : null
        const despues = destino
          ? (await db('users').where({ id: destino }).first())?.full_name ?? null
          : null
        await registrarEvento(ticket.id, 'asignacion', antes, despues, actor(req).id)
      }

      const [actualizado] = await db('support_tickets').where({ id: ticket.id }).update(cambios).returning('*')
      return res.json({ data: actualizado })
    } catch (err) {
      return next(err)
    }
  }
}

export const supportController = new SupportController()
