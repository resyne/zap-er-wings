-- Create work_order_logs table for tracking work order activities
CREATE TABLE IF NOT EXISTS public.work_order_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.work_order_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for work_order_logs
CREATE POLICY "Users can view work order logs"
  ON public.work_order_logs
  FOR SELECT
  USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can create work order logs"
  ON public.work_order_logs
  FOR INSERT
  WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role) AND auth.uid() = user_id);

CREATE POLICY "Service role full access work order logs"
  ON public.work_order_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for better performance
CREATE INDEX idx_work_order_logs_work_order_id ON public.work_order_logs(work_order_id);
CREATE INDEX idx_work_order_logs_user_id ON public.work_order_logs(user_id);
CREATE INDEX idx_work_order_logs_created_at ON public.work_order_logs(created_at DESC);

-- Create function to log work order changes
CREATE OR REPLACE FUNCTION log_work_order_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changes JSONB := '{}'::jsonb;
  old_val TEXT;
  new_val TEXT;
BEGIN
  -- Track specific field changes
  IF TG_OP = 'UPDATE' THEN
    -- Status change
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      changes := jsonb_set(changes, '{changes,status}', 
        jsonb_build_object('old', OLD.status, 'new', NEW.status));
    END IF;
    
    -- Assignment change
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      changes := jsonb_set(changes, '{changes,assigned_to}', 
        jsonb_build_object('old', OLD.assigned_to, 'new', NEW.assigned_to));
    END IF;
    
    -- Priority change
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
      changes := jsonb_set(changes, '{changes,priority}', 
        jsonb_build_object('old', OLD.priority, 'new', NEW.priority));
    END IF;

    -- Only log if there are actual changes
    IF changes != '{}'::jsonb THEN
      INSERT INTO work_order_logs (work_order_id, user_id, action, details)
      VALUES (NEW.id, auth.uid(), 'updated', changes);
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO work_order_logs (work_order_id, user_id, action, details)
    VALUES (NEW.id, COALESCE(auth.uid(), NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid), 'created', 
      jsonb_build_object('message', 'Commessa di produzione creata'));
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for work order changes
DROP TRIGGER IF EXISTS work_order_change_trigger ON public.work_orders;
CREATE TRIGGER work_order_change_trigger
  AFTER INSERT OR UPDATE ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION log_work_order_change();