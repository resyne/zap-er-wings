-- Rimuovi il trigger duplicato per le notifiche dei task
-- Mantieni solo notify_task_assignment_trigger e rimuovi trigger_notify_task_assignment

DROP TRIGGER IF EXISTS trigger_notify_task_assignment ON tasks;

-- Verifica che notify_task_assignment_trigger esista ancora
-- (questo è il trigger che vogliamo mantenere)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'notify_task_assignment_trigger' 
    AND tgrelid = 'tasks'::regclass
  ) THEN
    -- Se non esiste, ricrealo
    CREATE TRIGGER notify_task_assignment_trigger
      AFTER INSERT OR UPDATE ON tasks
      FOR EACH ROW
      EXECUTE FUNCTION notify_task_assignment();
  END IF;
END $$;