ALTER TABLE purchase_orders DROP CONSTRAINT purchase_orders_production_status_check;
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_production_status_check 
  CHECK (production_status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'in_production'::text, 'ready_to_ship'::text, 'shipped'::text, 'delivered'::text, 'cancelled'::text]));