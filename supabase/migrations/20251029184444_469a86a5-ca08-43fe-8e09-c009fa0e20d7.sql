-- Fix log_shipping_order_change function to remove reference to non-existent delivery_address field
CREATE OR REPLACE FUNCTION public.log_shipping_order_change()
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

    IF OLD.shipping_address IS DISTINCT FROM NEW.shipping_address THEN
      changes := jsonb_set(changes, '{changes,shipping_address}', 
        jsonb_build_object('old', OLD.shipping_address, 'new', NEW.shipping_address));
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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public';