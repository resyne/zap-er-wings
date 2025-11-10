-- Function to check if all work orders are complete and update sales order status
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

  -- Count completed work orders
  SELECT 
    (SELECT COUNT(*) FROM work_orders WHERE sales_order_id = v_sales_order_id AND status = 'completato') +
    (SELECT COUNT(*) FROM service_work_orders WHERE sales_order_id = v_sales_order_id AND status = 'completato') +
    (SELECT COUNT(*) FROM shipping_orders WHERE sales_order_id = v_sales_order_id AND status = 'completato')
  INTO v_completed_work_orders;

  -- If all work orders are complete, update sales order status to 'completato'
  IF v_total_work_orders > 0 AND v_completed_work_orders = v_total_work_orders THEN
    UPDATE sales_orders 
    SET status = 'completato', updated_at = now()
    WHERE id = v_sales_order_id AND status != 'completato';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_update_sales_order_on_work_order_complete ON work_orders;
DROP TRIGGER IF EXISTS trigger_update_sales_order_on_service_work_order_complete ON service_work_orders;
DROP TRIGGER IF EXISTS trigger_update_sales_order_on_shipping_order_complete ON shipping_orders;

-- Create triggers on work_orders table
CREATE TRIGGER trigger_update_sales_order_on_work_order_complete
AFTER INSERT OR UPDATE OF status ON work_orders
FOR EACH ROW
EXECUTE FUNCTION update_sales_order_status_on_work_orders_complete();

-- Create triggers on service_work_orders table
CREATE TRIGGER trigger_update_sales_order_on_service_work_order_complete
AFTER INSERT OR UPDATE OF status ON service_work_orders
FOR EACH ROW
EXECUTE FUNCTION update_sales_order_status_on_work_orders_complete();

-- Create triggers on shipping_orders table
CREATE TRIGGER trigger_update_sales_order_on_shipping_order_complete
AFTER INSERT OR UPDATE OF status ON shipping_orders
FOR EACH ROW
EXECUTE FUNCTION update_sales_order_status_on_work_orders_complete();