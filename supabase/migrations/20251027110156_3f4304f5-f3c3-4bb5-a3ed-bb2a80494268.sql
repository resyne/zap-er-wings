-- Forza un ricalcolo dello stato per tutti gli ordini esistenti
-- Modificando temporaneamente lo status delle commesse per triggerare la funzione

-- Per work_orders
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, status FROM work_orders WHERE sales_order_id IS NOT NULL
  LOOP
    -- Forza il trigger modificando lo status temporaneamente
    UPDATE work_orders 
    SET status = status 
    WHERE id = r.id;
  END LOOP;
END $$;

-- Per service_work_orders
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, status FROM service_work_orders WHERE sales_order_id IS NOT NULL
  LOOP
    UPDATE service_work_orders 
    SET status = status 
    WHERE id = r.id;
  END LOOP;
END $$;

-- Per shipping_orders
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, status FROM shipping_orders WHERE sales_order_id IS NOT NULL
  LOOP
    UPDATE shipping_orders 
    SET status = status 
    WHERE id = r.id;
  END LOOP;
END $$;