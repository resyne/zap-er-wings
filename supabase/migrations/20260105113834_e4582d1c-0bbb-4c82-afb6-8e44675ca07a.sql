-- Function to check if all work orders of a sales order are completed and update the sales order status
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

  -- Count work_orders
  SELECT COUNT(*), 
         COUNT(*) FILTER (WHERE status IN ('completato', 'completed'))
  INTO v_total_work_orders, v_completed_work_orders
  FROM work_orders
  WHERE sales_order_id = v_sales_order_id;

  -- Count service_work_orders
  SELECT COUNT(*), 
         COUNT(*) FILTER (WHERE status IN ('completato', 'completed'))
  INTO v_total_service_work_orders, v_completed_service_work_orders
  FROM service_work_orders
  WHERE sales_order_id = v_sales_order_id;

  -- Count shipping_orders
  SELECT COUNT(*), 
         COUNT(*) FILTER (WHERE status IN ('spedito', 'consegnato', 'completed'))
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

-- Create trigger on work_orders table
DROP TRIGGER IF EXISTS trg_check_sales_order_completion_work_orders ON work_orders;
CREATE TRIGGER trg_check_sales_order_completion_work_orders
AFTER UPDATE OF status ON work_orders
FOR EACH ROW
EXECUTE FUNCTION check_and_update_sales_order_status();

-- Create trigger on service_work_orders table
DROP TRIGGER IF EXISTS trg_check_sales_order_completion_service_work_orders ON service_work_orders;
CREATE TRIGGER trg_check_sales_order_completion_service_work_orders
AFTER UPDATE OF status ON service_work_orders
FOR EACH ROW
EXECUTE FUNCTION check_and_update_sales_order_status();

-- Create trigger on shipping_orders table
DROP TRIGGER IF EXISTS trg_check_sales_order_completion_shipping_orders ON shipping_orders;
CREATE TRIGGER trg_check_sales_order_completion_shipping_orders
AFTER UPDATE OF status ON shipping_orders
FOR EACH ROW
EXECUTE FUNCTION check_and_update_sales_order_status();