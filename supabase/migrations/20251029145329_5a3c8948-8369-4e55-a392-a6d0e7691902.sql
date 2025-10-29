-- Create notification triggers for service work orders and shipping orders

-- Trigger for service work order assignment notifications
CREATE OR REPLACE FUNCTION notify_service_work_order_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip if no assignment or self-assignment
  IF NEW.service_responsible_id IS NULL OR NEW.service_responsible_id = auth.uid() THEN
    RETURN NEW;
  END IF;
  
  -- Check if assignment changed
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.service_responsible_id IS NULL OR OLD.service_responsible_id != NEW.service_responsible_id)) THEN
    PERFORM create_notification(
      NEW.service_responsible_id,
      'Nuova commessa di lavoro assegnata',
      'Ti è stata assegnata la commessa: ' || COALESCE(NEW.title, NEW.number, 'Senza titolo'),
      'assignment',
      'service_work_order',
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for shipping order assignment notifications
CREATE OR REPLACE FUNCTION notify_shipping_order_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip if no assignment or self-assignment
  IF NEW.shipping_responsible_id IS NULL OR NEW.shipping_responsible_id = auth.uid() THEN
    RETURN NEW;
  END IF;
  
  -- Check if assignment changed
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.shipping_responsible_id IS NULL OR OLD.shipping_responsible_id != NEW.shipping_responsible_id)) THEN
    PERFORM create_notification(
      NEW.shipping_responsible_id,
      'Nuova commessa di spedizione assegnata',
      'Ti è stata assegnata la commessa: ' || COALESCE(NEW.number, 'Senza titolo'),
      'assignment',
      'shipping_order',
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers
CREATE TRIGGER service_work_order_assignment_trigger
  AFTER INSERT OR UPDATE ON service_work_orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_service_work_order_assignment();

CREATE TRIGGER shipping_order_assignment_trigger
  AFTER INSERT OR UPDATE ON shipping_orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_shipping_order_assignment();