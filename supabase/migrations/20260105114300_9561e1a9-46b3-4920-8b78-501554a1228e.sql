-- Fix the function with correct status values for each table
CREATE OR REPLACE FUNCTION public.check_and_update_sales_order_status()
RETURNS TRIGGER AS $$
DECLARE
  v_sales_order_id UUID;
  v_total_work_orders INTEGER;
  v_completed_work_orders INTEGER;
  v_total_service_work_orders INTEGER;
  v_completed_service_work_orders INTEGER;
  v_total_shipping_orders INTEGER;
  v_completed_shipping_orders INTEGER;
  v_all_completed BOOLEAN;
BEGIN
  -- Get the sales_order_id from the updated record
  IF TG_TABLE_NAME = 'work_orders' THEN
    v_sales_order_id := COALESCE(NEW.sales_order_id, OLD.sales_order_id);
  ELSIF TG_TABLE_NAME = 'service_work_orders' THEN
    v_sales_order_id := COALESCE(NEW.sales_order_id, OLD.sales_order_id);
  ELSIF TG_TABLE_NAME = 'shipping_orders' THEN
    v_sales_order_id := COALESCE(NEW.sales_order_id, OLD.sales_order_id);
  END IF;

  -- If no sales_order_id, exit
  IF v_sales_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count work_orders (status is enum wo_status: 'completato')
  SELECT COUNT(*), 
         COUNT(*) FILTER (WHERE status = 'completato')
  INTO v_total_work_orders, v_completed_work_orders
  FROM work_orders
  WHERE sales_order_id = v_sales_order_id;

  -- Count service_work_orders (status is text: 'completata')
  SELECT COUNT(*), 
         COUNT(*) FILTER (WHERE status = 'completata')
  INTO v_total_service_work_orders, v_completed_service_work_orders
  FROM service_work_orders
  WHERE sales_order_id = v_sales_order_id;

  -- Count shipping_orders (status is text: 'spedito')
  SELECT COUNT(*), 
         COUNT(*) FILTER (WHERE status = 'spedito')
  INTO v_total_shipping_orders, v_completed_shipping_orders
  FROM shipping_orders
  WHERE sales_order_id = v_sales_order_id;

  -- Check if there are any work orders and all are completed
  v_all_completed := 
    (v_total_work_orders + v_total_service_work_orders + v_total_shipping_orders) > 0 AND
    (v_total_work_orders = v_completed_work_orders) AND
    (v_total_service_work_orders = v_completed_service_work_orders) AND
    (v_total_shipping_orders = v_completed_shipping_orders);

  -- Update sales_order status if all work orders are completed
  IF v_all_completed THEN
    UPDATE sales_orders
    SET status = 'completato',
        archived = true
    WHERE id = v_sales_order_id
      AND status != 'completato';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update existing orders that have all work orders completed
UPDATE sales_orders so
SET status = 'completato', archived = true
WHERE so.status != 'completato'
AND EXISTS (
  SELECT 1 FROM (
    SELECT so2.id,
      (SELECT COUNT(*) FROM work_orders WHERE sales_order_id = so2.id) as total_wo,
      (SELECT COUNT(*) FROM work_orders WHERE sales_order_id = so2.id AND status = 'completato') as completed_wo,
      (SELECT COUNT(*) FROM service_work_orders WHERE sales_order_id = so2.id) as total_swo,
      (SELECT COUNT(*) FROM service_work_orders WHERE sales_order_id = so2.id AND status = 'completata') as completed_swo,
      (SELECT COUNT(*) FROM shipping_orders WHERE sales_order_id = so2.id) as total_ship,
      (SELECT COUNT(*) FROM shipping_orders WHERE sales_order_id = so2.id AND status = 'spedito') as completed_ship
    FROM sales_orders so2 WHERE so2.id = so.id
  ) sub
  WHERE (sub.total_wo + sub.total_swo + sub.total_ship) > 0
    AND sub.total_wo = sub.completed_wo
    AND sub.total_swo = sub.completed_swo
    AND sub.total_ship = sub.completed_ship
);