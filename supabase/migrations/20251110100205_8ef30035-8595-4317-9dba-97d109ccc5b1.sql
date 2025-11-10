-- Aggiorna il trigger per gestire sia 'completato' che 'completata'
CREATE OR REPLACE FUNCTION update_sales_order_status_on_work_orders_complete()
RETURNS TRIGGER AS $$
DECLARE
  v_sales_order_id uuid;
  v_total_work_orders integer;
  v_completed_work_orders integer;
BEGIN
  -- Get the sales_order_id from the work order that was updated
  IF TG_TABLE_NAME = 'work_orders' THEN
    v_sales_order_id := COALESCE(NEW.sales_order_id, OLD.sales_order_id);
  ELSIF TG_TABLE_NAME = 'service_work_orders' THEN
    v_sales_order_id := COALESCE(NEW.sales_order_id, OLD.sales_order_id);
  ELSIF TG_TABLE_NAME = 'shipping_orders' THEN
    v_sales_order_id := COALESCE(NEW.sales_order_id, OLD.sales_order_id);
  END IF;

  -- Exit if no sales_order_id
  IF v_sales_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count total work orders for this sales order
  SELECT 
    (SELECT COUNT(*) FROM work_orders WHERE sales_order_id = v_sales_order_id) +
    (SELECT COUNT(*) FROM service_work_orders WHERE sales_order_id = v_sales_order_id) +
    (SELECT COUNT(*) FROM shipping_orders WHERE sales_order_id = v_sales_order_id)
  INTO v_total_work_orders;

  -- Count completed work orders (gestisce sia 'completato' che 'completata')
  SELECT 
    (SELECT COUNT(*) FROM work_orders WHERE sales_order_id = v_sales_order_id AND status::text IN ('completato', 'completata')) +
    (SELECT COUNT(*) FROM service_work_orders WHERE sales_order_id = v_sales_order_id AND status::text IN ('completato', 'completata')) +
    (SELECT COUNT(*) FROM shipping_orders WHERE sales_order_id = v_sales_order_id AND status::text IN ('completato', 'completata', 'spedito'))
  INTO v_completed_work_orders;

  -- If all work orders are complete, update sales order status to 'completato'
  IF v_total_work_orders > 0 AND v_completed_work_orders = v_total_work_orders THEN
    UPDATE sales_orders 
    SET status = 'completato', updated_at = now()
    WHERE id = v_sales_order_id AND status != 'completato';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Aggiorna manualmente gli ordini esistenti che hanno tutte le commesse completate
UPDATE sales_orders so
SET status = 'completato', updated_at = now()
WHERE status != 'completato'
AND (
  -- Controlla se tutte le commesse sono completate
  (SELECT COUNT(*) FROM work_orders WHERE sales_order_id = so.id) +
  (SELECT COUNT(*) FROM service_work_orders WHERE sales_order_id = so.id) +
  (SELECT COUNT(*) FROM shipping_orders WHERE sales_order_id = so.id) > 0
)
AND (
  (SELECT COUNT(*) FROM work_orders WHERE sales_order_id = so.id AND status::text IN ('completato', 'completata')) +
  (SELECT COUNT(*) FROM service_work_orders WHERE sales_order_id = so.id AND status::text IN ('completato', 'completata')) +
  (SELECT COUNT(*) FROM shipping_orders WHERE sales_order_id = so.id AND status::text IN ('completato', 'completata', 'spedito'))
) = (
  (SELECT COUNT(*) FROM work_orders WHERE sales_order_id = so.id) +
  (SELECT COUNT(*) FROM service_work_orders WHERE sales_order_id = so.id) +
  (SELECT COUNT(*) FROM shipping_orders WHERE sales_order_id = so.id)
);