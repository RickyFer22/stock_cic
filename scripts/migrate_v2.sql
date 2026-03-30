-- Migration v2: features from sistema-stock-accion-social (alerts, expiry, location, inbound/outbound metadata)
-- Safe to run multiple times.

BEGIN;

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS expiry_date date;

CREATE INDEX IF NOT EXISTS items_expiry_date_idx ON items (expiry_date);

ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS movement_type text,
  ADD COLUMN IF NOT EXISTS counterparty text;

CREATE TABLE IF NOT EXISTS alert_acknowledgements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN ('low_stock','expiry_30_days','expiry_15_days','expiry_7_days','expired')),
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_by uuid REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (item_id, alert_type)
);

COMMIT;

