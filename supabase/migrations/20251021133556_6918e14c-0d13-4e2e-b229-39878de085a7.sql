-- Aggiungi campo archived alla tabella work_orders
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- Aggiungi campo archived alla tabella service_work_orders
ALTER TABLE service_work_orders ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- Aggiungi campo archived alla tabella shipping_orders
ALTER TABLE shipping_orders ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- Crea indici per migliorare le performance delle query
CREATE INDEX IF NOT EXISTS idx_work_orders_archived ON work_orders(archived);
CREATE INDEX IF NOT EXISTS idx_service_work_orders_archived ON service_work_orders(archived);
CREATE INDEX IF NOT EXISTS idx_shipping_orders_archived ON shipping_orders(archived);