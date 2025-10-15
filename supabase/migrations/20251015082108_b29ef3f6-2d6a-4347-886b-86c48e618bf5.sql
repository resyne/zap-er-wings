-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- 'assignment', 'deadline', 'tag', 'update'
  entity_type TEXT, -- 'task', 'lead', 'work_order', etc.
  entity_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access notifications"
  ON public.notifications
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);

-- Function to create notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, entity_type, entity_id)
  VALUES (p_user_id, p_title, p_message, p_type, p_entity_type, p_entity_id)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- Trigger function for task assignments
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_title TEXT;
  v_assignee_name TEXT;
BEGIN
  -- Skip if no assignment or it's a template
  IF NEW.assigned_to IS NULL OR NEW.is_template = true THEN
    RETURN NEW;
  END IF;
  
  -- Check if assignment changed
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to)) THEN
    SELECT title INTO v_task_title FROM tasks WHERE id = NEW.id;
    
    PERFORM create_notification(
      NEW.assigned_to,
      'Nuovo task assegnato',
      'Ti è stato assegnato il task: ' || COALESCE(NEW.title, 'Senza titolo'),
      'assignment',
      'task',
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for lead assignments
CREATE OR REPLACE FUNCTION public.notify_lead_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip if no assignment
  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if assignment changed
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to)) THEN
    PERFORM create_notification(
      NEW.assigned_to,
      'Nuovo lead assegnato',
      'Ti è stato assegnato il lead: ' || COALESCE(NEW.company_name, NEW.contact_name, 'Senza nome'),
      'assignment',
      'lead',
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for work order assignments
CREATE OR REPLACE FUNCTION public.notify_work_order_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip if no assignment
  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if assignment changed
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to)) THEN
    PERFORM create_notification(
      NEW.assigned_to,
      'Nuovo ordine di lavoro assegnato',
      'Ti è stato assegnato l''ordine: ' || COALESCE(NEW.title, NEW.number, 'Senza titolo'),
      'assignment',
      'work_order',
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_notify_task_assignment ON public.tasks;
CREATE TRIGGER trigger_notify_task_assignment
  AFTER INSERT OR UPDATE OF assigned_to ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_assignment();

DROP TRIGGER IF EXISTS trigger_notify_lead_assignment ON public.leads;
CREATE TRIGGER trigger_notify_lead_assignment
  AFTER INSERT OR UPDATE OF assigned_to ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_lead_assignment();

DROP TRIGGER IF EXISTS trigger_notify_work_order_assignment ON public.work_orders;
CREATE TRIGGER trigger_notify_work_order_assignment
  AFTER INSERT OR UPDATE OF assigned_to ON public.work_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_work_order_assignment();