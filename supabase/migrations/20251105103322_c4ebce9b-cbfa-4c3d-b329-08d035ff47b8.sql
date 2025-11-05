-- Crea i trigger per aggiornare automaticamente lo stato del sales_order quando le commesse vengono completate

-- Trigger per work_orders
DROP TRIGGER IF EXISTS update_sales_order_on_work_order_change ON work_orders;
CREATE TRIGGER update_sales_order_on_work_order_change
  AFTER INSERT OR UPDATE OF status ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_order_status_from_sub_orders();

-- Trigger per service_work_orders  
DROP TRIGGER IF EXISTS update_sales_order_on_service_work_order_change ON service_work_orders;
CREATE TRIGGER update_sales_order_on_service_work_order_change
  AFTER INSERT OR UPDATE OF status ON service_work_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_order_status_from_sub_orders();

-- Trigger per shipping_orders
DROP TRIGGER IF EXISTS update_sales_order_on_shipping_order_change ON shipping_orders;
CREATE TRIGGER update_sales_order_on_shipping_order_change
  AFTER INSERT OR UPDATE OF status ON shipping_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_order_status_from_sub_orders();