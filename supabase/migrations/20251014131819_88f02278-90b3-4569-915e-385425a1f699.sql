-- Enable pg_cron and pg_net extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function to notify task assignment via edge function
CREATE OR REPLACE FUNCTION notify_task_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only notify if task is assigned and it's not a template
  IF NEW.assigned_to IS NOT NULL AND (NEW.is_template IS FALSE OR NEW.is_template IS NULL) THEN
    -- Call edge function asynchronously using pg_net
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/send-task-assignment',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
      ),
      body := jsonb_build_object(
        'type', TG_OP,
        'table', TG_TABLE_NAME,
        'record', row_to_json(NEW),
        'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for task assignment notifications
DROP TRIGGER IF EXISTS trigger_notify_task_assignment ON tasks;
CREATE TRIGGER trigger_notify_task_assignment
  AFTER INSERT OR UPDATE OF assigned_to ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION notify_task_assignment();

-- Set configuration for Supabase URL and anon key (these need to be set by admin)
-- Users will need to run these commands manually with their actual values:
-- ALTER DATABASE postgres SET app.supabase_url = 'https://rucjkoleodtwrbftwgsm.supabase.co';
-- ALTER DATABASE postgres SET app.supabase_anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

-- Schedule task reminders to run every day at 8:00 AM
SELECT cron.schedule(
  'send-daily-task-reminders',
  '0 8 * * *', -- Every day at 8:00 AM
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/send-task-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
    ),
    body := jsonb_build_object('time', now())
  ) as request_id;
  $$
);