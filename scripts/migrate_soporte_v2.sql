-- ═══════════════════════════════════════════════════════════════════
-- Soporte v2 · modelo de tres tablas
--
-- La tabla original tenía cuatro campos de negocio (consulta, estado,
-- ultimo_mensaje, respuestas) y no soportaba seguimiento: sin prioridad, sin
-- responsable, sin categoría, sin historial de estados, y con los mensajes
-- guardados en un único jsonb que el cliente reemplazaba entero.
--
-- Idempotente: se puede correr más de una vez sin efecto adicional.
-- Uso:
--   docker exec -i stock-cic-db-1 sh -c 'psql -U $POSTGRES_USER -d $POSTGRES_DB' < migrate_soporte_v2.sql
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Campos nuevos en support_tickets ──────────────────────────────

-- Número legible: un ticket identificado como "#a3f9c210" (los primeros 8
-- caracteres de un UUID) no se puede dictar por teléfono ni buscar.
CREATE SEQUENCE IF NOT EXISTS support_ticket_numero_seq;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS numero integer;
ALTER TABLE support_tickets ALTER COLUMN numero SET DEFAULT nextval('support_ticket_numero_seq');

ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS titulo text;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS categoria text;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS prioridad text;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS asignado_a uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS vence_en timestamptz;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS primera_respuesta_en timestamptz;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS resuelto_en timestamptz;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS cerrado_en timestamptz;

-- Numerar los tickets que ya existan, por orden de creación.
UPDATE support_tickets t
   SET numero = s.n
  FROM (SELECT id, row_number() OVER (ORDER BY created_at) AS n
          FROM support_tickets WHERE numero IS NULL) s
 WHERE t.id = s.id AND t.numero IS NULL;

SELECT setval('support_ticket_numero_seq', GREATEST(COALESCE((SELECT MAX(numero) FROM support_tickets), 0), 1));

-- Título por defecto para los preexistentes: primeros 80 caracteres de la consulta.
UPDATE support_tickets
   SET titulo = left(regexp_replace(consulta, '\s+', ' ', 'g'), 80)
 WHERE titulo IS NULL;

UPDATE support_tickets SET categoria  = 'Otro'   WHERE categoria  IS NULL;
UPDATE support_tickets SET prioridad  = 'Normal' WHERE prioridad  IS NULL;

-- ── 2. Estados: de texto libre a lista cerrada ───────────────────────
-- Se mapean los estados anteriores a la nomenclatura nueva antes de restringir.
UPDATE support_tickets SET estado = 'Sin asignar' WHERE estado IN ('Pendiente', '');
UPDATE support_tickets SET estado = 'En proceso'  WHERE estado = 'En Proceso';

ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_estado_chk;
ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_estado_chk CHECK (
  estado IN ('Sin asignar', 'En análisis', 'Pendiente de información',
             'En proceso', 'Resuelto', 'Cerrado', 'Reabierto')
);

ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_prioridad_chk;
ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_prioridad_chk CHECK (
  prioridad IN ('Baja', 'Normal', 'Alta', 'Crítica')
);

ALTER TABLE support_tickets ALTER COLUMN estado SET DEFAULT 'Sin asignar';

-- ── 3. Mensajes en su propia tabla ───────────────────────────────────
-- Guardarlos en un jsonb que el cliente reemplazaba entero hacía que dos
-- personas respondiendo a la vez se pisaran los mensajes.
CREATE TABLE IF NOT EXISTS support_messages (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id   uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  autor_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  cuerpo      text NOT NULL,
  -- 'visible' la ve el solicitante; 'interna' solo el equipo de soporte.
  visibilidad text NOT NULL DEFAULT 'visible' CHECK (visibilidad IN ('visible', 'interna')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_messages_ticket_idx ON support_messages (ticket_id, created_at);

-- Migrar los mensajes que estuvieran en el jsonb.
INSERT INTO support_messages (ticket_id, autor_id, cuerpo, visibilidad, created_at)
SELECT t.id,
       CASE WHEN m->>'rol' = 'usuario' THEN t.user_id ELSE NULL END,
       COALESCE(m->>'mensaje', ''),
       'visible',
       COALESCE((m->>'fecha')::timestamptz, t.created_at)
  FROM support_tickets t,
       LATERAL jsonb_array_elements(COALESCE(t.respuestas, '[]'::jsonb)) m
 WHERE COALESCE(m->>'mensaje', '') <> ''
   AND NOT EXISTS (SELECT 1 FROM support_messages sm WHERE sm.ticket_id = t.id);

-- ── 4. Historial de cambios ──────────────────────────────────────────
-- Sin esto, un cierre accidental no se distingue de uno deliberado y no hay a
-- quién preguntarle.
CREATE TABLE IF NOT EXISTS support_events (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id      uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  tipo           text NOT NULL,
  valor_anterior text,
  valor_nuevo    text,
  actor_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_events_ticket_idx ON support_events (ticket_id, created_at);

-- ── 5. Índices de la bandeja ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS support_tickets_estado_idx     ON support_tickets (estado);
CREATE INDEX IF NOT EXISTS support_tickets_asignado_idx   ON support_tickets (asignado_a);
CREATE INDEX IF NOT EXISTS support_tickets_created_idx    ON support_tickets (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS support_tickets_numero_uidx ON support_tickets (numero);

COMMIT;

-- ── Verificación ─────────────────────────────────────────────────────
SELECT 'tickets' AS tabla, count(*) AS filas FROM support_tickets
UNION ALL SELECT 'mensajes', count(*) FROM support_messages
UNION ALL SELECT 'eventos',  count(*) FROM support_events;

SELECT column_name FROM information_schema.columns
 WHERE table_name = 'support_tickets'
   AND column_name IN ('numero','titulo','categoria','prioridad','asignado_a','vence_en')
 ORDER BY column_name;
