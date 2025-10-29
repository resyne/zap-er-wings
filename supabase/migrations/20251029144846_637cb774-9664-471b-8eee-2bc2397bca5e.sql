-- Create log tables for service work orders and shipping orders
CREATE TABLE IF NOT EXISTS service_work_order_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_work_order_id UUID NOT NULL REFERENCES service_work_orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  details JSONB,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shipping_order_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_order_id UUID NOT NULL REFERENCES shipping_orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  details JSONB,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on log tables
ALTER TABLE service_work_order_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_order_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for service_work_order_logs
CREATE POLICY "Users can view service work order logs" ON service_work_order_logs
  FOR SELECT USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Service role full access service work order logs" ON service_work_order_logs
  FOR ALL USING (true) WITH CHECK (true);

-- RLS policies for shipping_order_logs
CREATE POLICY "Users can view shipping order logs" ON shipping_order_logs
  FOR SELECT USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Service role full access shipping order logs" ON shipping_order_logs
  FOR ALL USING (true) WITH CHECK (true);

-- Create function to log service work order changes
CREATE OR REPLACE FUNCTION log_service_work_order_change()
RETURNS TRIGGER AS $$
DECLARE
  changes JSONB := '{}'::jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Track specific field changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      changes := jsonb_set(changes, '{changes,status}', 
        jsonb_build_object('old', OLD.status, 'new', NEW.status));
    END IF;
    
    IF OLD.service_responsible_id IS DISTINCT FROM NEW.service_responsible_id THEN
      changes := jsonb_set(changes, '{changes,service_responsible_id}', 
        jsonb_build_object('old', OLD.service_responsible_id, 'new', NEW.service_responsible_id));
    END IF;
    
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
      changes := jsonb_set(changes, '{changes,priority}', 
        jsonb_build_object('old', OLD.priority, 'new', NEW.priority));
    END IF;

    IF OLD.title IS DISTINCT FROM NEW.title THEN
      changes := jsonb_set(changes, '{changes,title}', 
        jsonb_build_object('old', OLD.title, 'new', NEW.title));
    END IF;

    IF OLD.scheduled_date IS DISTINCT FROM NEW.scheduled_date THEN
      changes := jsonb_set(changes, '{changes,scheduled_date}', 
        jsonb_build_object('old', OLD.scheduled_date, 'new', NEW.scheduled_date));
    END IF;

    -- Only log if there are actual changes
    IF changes != '{}'::jsonb THEN
      INSERT INTO service_work_order_logs (service_work_order_id, user_id, action, details)
      VALUES (NEW.id, auth.uid(), 'updated', changes);
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO service_work_order_logs (service_work_order_id, user_id, action, details)
    VALUES (NEW.id, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'created', 
      jsonb_build_object('message', 'Commessa di lavoro creata'));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to log shipping order changes
CREATE OR REPLACE FUNCTION log_shipping_order_change()
RETURNS TRIGGER AS $$
DECLARE
  changes JSONB := '{}'::jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Track specific field changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      changes := jsonb_set(changes, '{changes,status}', 
        jsonb_build_object('old', OLD.status, 'new', NEW.status));
    END IF;
    
    IF OLD.shipping_responsible_id IS DISTINCT FROM NEW.shipping_responsible_id THEN
      changes := jsonb_set(changes, '{changes,shipping_responsible_id}', 
        jsonb_build_object('old', OLD.shipping_responsible_id, 'new', NEW.shipping_responsible_id));
    END IF;

    IF OLD.shipping_date IS DISTINCT FROM NEW.shipping_date THEN
      changes := jsonb_set(changes, '{changes,shipping_date}', 
        jsonb_build_object('old', OLD.shipping_date, 'new', NEW.shipping_date));
    END IF;

    IF OLD.delivery_address IS DISTINCT FROM NEW.delivery_address THEN
      changes := jsonb_set(changes, '{changes,delivery_address}', 
        jsonb_build_object('old', OLD.delivery_address, 'new', NEW.delivery_address));
    END IF;

    -- Only log if there are actual changes
    IF changes != '{}'::jsonb THEN
      INSERT INTO shipping_order_logs (shipping_order_id, user_id, action, details)
      VALUES (NEW.id, auth.uid(), 'updated', changes);
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO shipping_order_logs (shipping_order_id, user_id, action, details)
    VALUES (NEW.id, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 'created', 
      jsonb_build_object('message', 'Commessa di spedizione creata'));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers
CREATE TRIGGER service_work_order_change_trigger
  AFTER INSERT OR UPDATE ON service_work_orders
  FOR EACH ROW
  EXECUTE FUNCTION log_service_work_order_change();

CREATE TRIGGER shipping_order_change_trigger
  AFTER INSERT OR UPDATE ON shipping_orders
  FOR EACH ROW
  EXECUTE FUNCTION log_shipping_order_change();