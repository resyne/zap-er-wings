-- Create function to update sales order status based on sub-orders
CREATE OR REPLACE FUNCTION update_sales_order_status_from_sub_orders()
RETURNS TRIGGER AS $$
DECLARE
  v_sales_order_id UUID;
  v_all_completed BOOLEAN;
  v_any_in_progress BOOLEAN;
  v_new_status TEXT;
BEGIN
  -- Get the sales_order_id from the trigger
  IF TG_TABLE_NAME = 'work_orders' THEN
    v_sales_order_id := NEW.sales_order_id;
  ELSIF TG_TABLE_NAME = 'service_work_orders' THEN
    v_sales_order_id := NEW.sales_order_id;
  ELSIF TG_TABLE_NAME = 'shipping_orders' THEN
    v_sales_order_id := NEW.sales_order_id;
  END IF;

  -- Skip if no sales_order_id
  IF v_sales_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if all sub-orders are completed
  SELECT 
    COALESCE(
      (SELECT COUNT(*) = 0 OR bool_and(status IN ('completed', 'completato'))
       FROM work_orders 
       WHERE sales_order_id = v_sales_order_id), 
      true
    ) AND
    COALESCE(
      (SELECT COUNT(*) = 0 OR bool_and(status IN ('completed', 'completato'))
       FROM service_work_orders 
       WHERE sales_order_id = v_sales_order_id), 
      true
    ) AND
    COALESCE(
      (SELECT COUNT(*) = 0 OR bool_and(status IN ('spedito', 'completed'))
       FROM shipping_orders 
       WHERE sales_order_id = v_sales_order_id), 
      true
    )
  INTO v_all_completed;

  -- Check if any sub-order is in progress
  SELECT 
    COALESCE(
      (SELECT bool_or(status IN ('in_progress', 'in_lavorazione', 'in_corso'))
       FROM work_orders 
       WHERE sales_order_id = v_sales_order_id), 
      false
    ) OR
    COALESCE(
      (SELECT bool_or(status IN ('in_progress', 'in_lavorazione', 'in_corso'))
       FROM service_work_orders 
       WHERE sales_order_id = v_sales_order_id), 
      false
    ) OR
    COALESCE(
      (SELECT bool_or(status IN ('in_preparazione', 'in_progress'))
       FROM shipping_orders 
       WHERE sales_order_id = v_sales_order_id), 
      false
    )
  INTO v_any_in_progress;

  -- Determine new status
  IF v_all_completed THEN
    v_new_status := 'completed';
  ELSIF v_any_in_progress THEN
    v_new_status := 'in_progress';
  ELSE
    -- Don't change status if no sub-orders are in progress or completed
    RETURN NEW;
  END IF;

  -- Update sales order status
  UPDATE sales_orders 
  SET status = v_new_status,
      updated_at = now()
  WHERE id = v_sales_order_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for work_orders
DROP TRIGGER IF EXISTS trigger_update_sales_order_status_from_work_orders ON work_orders;
CREATE TRIGGER trigger_update_sales_order_status_from_work_orders
  AFTER INSERT OR UPDATE OF status ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_order_status_from_sub_orders();

-- Create triggers for service_work_orders
DROP TRIGGER IF EXISTS trigger_update_sales_order_status_from_service_work_orders ON service_work_orders;
CREATE TRIGGER trigger_update_sales_order_status_from_service_work_orders
  AFTER INSERT OR UPDATE OF status ON service_work_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_order_status_from_sub_orders();

-- Create triggers for shipping_orders
DROP TRIGGER IF EXISTS trigger_update_sales_order_status_from_shipping_orders ON shipping_orders;
CREATE TRIGGER trigger_update_sales_order_status_from_shipping_orders
  AFTER INSERT OR UPDATE OF status ON shipping_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_order_status_from_sub_orders();