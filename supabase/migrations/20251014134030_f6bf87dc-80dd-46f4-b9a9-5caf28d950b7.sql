-- Rimuovi il trigger problematico temporaneamente
DROP TRIGGER IF EXISTS notify_task_assignment_trigger ON tasks;

-- Ricrea la funzione senza usare configurazioni del database
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Solo notifica se il task è assegnato e non è un template
  IF NEW.assigned_to IS NOT NULL AND (NEW.is_template IS FALSE OR NEW.is_template IS NULL) THEN
    -- Chiama la edge function in modo asincrono usando pg_net
    PERFORM net.http_post(
      url := 'https://rucjkoleodtwrbftwgsm.supabase.co/functions/v1/send-task-assignment',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1Y2prb2xlb2R0d3JiZnR3Z3NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3MDUzMTEsImV4cCI6MjA2NDI4MTMxMX0.zWVVI5NkW9YPLp1WN-Gleo8vn6UVDabRtNbW5FCUcnA'
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
$function$;

-- Ricrea il trigger
CREATE TRIGGER notify_task_assignment_trigger
  AFTER INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION notify_task_assignment();