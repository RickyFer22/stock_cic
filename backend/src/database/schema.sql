-- Sistema de Gestión de Stock - Acción Social
-- Municipalidad de San Roque
--
-- Nota: este esquema está pensado para inicialización automática con Docker
-- montándolo en /docker-entrypoint-initdb.d/.

BEGIN;

-- Extensiones útiles (búsqueda inteligente + hashes + UUID)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- Wrappers IMMUTABLE para poder indexar expresiones (unaccent es STABLE)
CREATE OR REPLACE FUNCTION sr_unaccent(txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT unaccent('unaccent', txt);
$$;

CREATE OR REPLACE FUNCTION sr_dmetaphone(txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT dmetaphone(sr_unaccent(txt));
$$;

-- Usuarios
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  username text NOT NULL UNIQUE,
  email text UNIQUE,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'supervisor', 'operador')),
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Soporte Tecnico
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consulta text NOT NULL,
  estado text NOT NULL DEFAULT 'Pendiente',
  ultimo_mensaje text,
  respuestas jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Categorías de ítems
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ítems
CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  unit text NOT NULL DEFAULT 'unidad',
  location text,
  stock_actual integer NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
  stock_minimo integer NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  stock_maximo integer CHECK (stock_maximo IS NULL OR stock_maximo >= 0),
  expiry_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Beneficiarios
CREATE TABLE IF NOT EXISTS beneficiaries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  dni text NOT NULL UNIQUE,
  apellido text NOT NULL,
  nombre text NOT NULL,
  fecha_nacimiento date,
  telefono text,
  direccion text,
  barrio text,
  observaciones text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Distribuciones
CREATE TABLE IF NOT EXISTS distributions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha timestamptz NOT NULL DEFAULT now(),
  beneficiary_id uuid NOT NULL REFERENCES beneficiaries(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  observaciones text,
  ip inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS distribution_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  distribution_id uuid NOT NULL REFERENCES distributions(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  UNIQUE (distribution_id, item_id)
);

-- Cierres de inventario
CREATE TABLE IF NOT EXISTS inventory_closings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('OPEN', 'CLOSED')) DEFAULT 'CLOSED',
  notes text,
  ip inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_closing_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  closing_id uuid NOT NULL REFERENCES inventory_closings(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  stock_sistema integer NOT NULL CHECK (stock_sistema >= 0),
  stock_contado integer NOT NULL CHECK (stock_contado >= 0),
  diferencia integer NOT NULL,
  UNIQUE (closing_id, item_id)
);

-- Movimientos de stock (fuente de verdad de auditoría)
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha timestamptz NOT NULL DEFAULT now(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('INGRESO', 'DISTRIBUTION', 'ADJUSTMENT')),
  movement_type text,
  quantity integer NOT NULL CHECK (quantity <> 0),
  counterparty text,
  notes text,
  distribution_id uuid REFERENCES distributions(id) ON DELETE SET NULL,
  closing_id uuid REFERENCES inventory_closings(id) ON DELETE SET NULL,
  ip inet,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_movements_kind_qty_chk CHECK (
    (kind = 'INGRESO' AND quantity > 0)
    OR (kind = 'DISTRIBUTION' AND quantity < 0)
    OR (kind = 'ADJUSTMENT')
  )
);

-- Índices clave
CREATE INDEX IF NOT EXISTS items_name_idx ON items (name);
CREATE INDEX IF NOT EXISTS items_code_idx ON items (code);
CREATE INDEX IF NOT EXISTS items_expiry_date_idx ON items (expiry_date);
CREATE INDEX IF NOT EXISTS beneficiaries_apellido_idx ON beneficiaries (apellido);
CREATE INDEX IF NOT EXISTS beneficiaries_dni_idx ON beneficiaries (dni);
CREATE INDEX IF NOT EXISTS beneficiaries_apellido_trgm_idx ON beneficiaries USING gin (sr_unaccent(apellido) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS beneficiaries_apellido_dmetaphone_idx ON beneficiaries (sr_dmetaphone(apellido));
CREATE INDEX IF NOT EXISTS distributions_fecha_idx ON distributions (fecha DESC);
CREATE INDEX IF NOT EXISTS stock_movements_fecha_idx ON stock_movements (fecha DESC);
CREATE INDEX IF NOT EXISTS stock_movements_item_idx ON stock_movements (item_id);

-- Acknowledgements (alerts computed on demand)
CREATE TABLE IF NOT EXISTS alert_acknowledgements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN ('low_stock','expiry_30_days','expiry_15_days','expiry_7_days','expired')),
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_by uuid REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (item_id, alert_type)
);

-- Trigger: actualiza items.stock_actual y bloquea stock negativo (doble validación DB)
CREATE OR REPLACE FUNCTION apply_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_stock integer;
  new_stock integer;
BEGIN
  SELECT stock_actual
    INTO current_stock
    FROM items
   WHERE id = NEW.item_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ítem no encontrado para movimiento de stock.'
      USING ERRCODE = '23503';
  END IF;

  new_stock := current_stock + NEW.quantity;

  IF new_stock < 0 THEN
    RAISE EXCEPTION 'Operación inválida: dejaría stock por debajo de cero.'
      USING ERRCODE = '23514';
  END IF;

  UPDATE items
     SET stock_actual = new_stock,
         updated_at = now()
   WHERE id = NEW.item_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_stock_movement ON stock_movements;
CREATE TRIGGER trg_apply_stock_movement
BEFORE INSERT ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION apply_stock_movement();

-- Seed mínimo (ajustar credenciales en producción)
INSERT INTO categories (name) VALUES
  ('Alimentos'),
  ('Higiene'),
  ('Limpieza')
ON CONFLICT DO NOTHING;

-- Importante: no se crean usuarios por defecto.
-- El alta de usuarios se realiza desde el panel Supervisor (admin)
-- o mediante script SQL controlado por el equipo de sistemas.

COMMIT;
