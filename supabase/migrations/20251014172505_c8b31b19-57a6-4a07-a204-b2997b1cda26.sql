-- Step 2: Aggiorna gli stati esistenti e crea il trigger
-- Ora possiamo usare i nuovi valori perché sono stati committati
UPDATE work_orders SET status = 'to_do' WHERE status = 'planned';
UPDATE work_orders SET status = 'in_lavorazione' WHERE status = 'in_progress';
UPDATE work_orders SET status = 'pronti' WHERE status = 'completed';
UPDATE work_orders SET status = 'spediti_consegnati' WHERE status = 'closed';

-- Crea una funzione per tracciare automaticamente i cambi di stato
CREATE OR REPLACE FUNCTION track_work_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  execution_step TEXT;
BEGIN
  -- Solo se lo stato è cambiato
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- Completa l'esecuzione precedente se esiste
    IF OLD.status IS NOT NULL THEN
      UPDATE executions 
      SET end_time = now()
      WHERE work_order_id = NEW.id 
        AND end_time IS NULL
        AND step_name LIKE 'Fase automatica:%';
    END IF;
    
    -- Determina il nome della fase in base al nuovo stato
    CASE NEW.status::text
      WHEN 'to_do' THEN
        execution_step := 'Fase automatica: Pianificazione';
      WHEN 'in_lavorazione' THEN
        execution_step := 'Fase automatica: Lavorazione';
      WHEN 'test' THEN
        execution_step := 'Fase automatica: Testing';
      WHEN 'pronti' THEN
        execution_step := 'Fase automatica: Completamento';
      WHEN 'spediti_consegnati' THEN
        execution_step := 'Fase automatica: Spedizione/Consegna';
      ELSE
        execution_step := NULL;
    END CASE;
    
    -- Crea una nuova esecuzione se c'è una fase da tracciare
    IF execution_step IS NOT NULL THEN
      INSERT INTO executions (
        work_order_id,
        step_name,
        start_time,
        notes
      ) VALUES (
        NEW.id,
        execution_step,
        now(),
        'Tracciamento automatico - Cambio stato: ' || COALESCE(OLD.status::text, 'NULL') || ' → ' || NEW.status::text
      );
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crea il trigger per il tracciamento automatico
DROP TRIGGER IF EXISTS track_work_order_status_trigger ON work_orders;
CREATE TRIGGER track_work_order_status_trigger
  AFTER UPDATE OF status ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION track_work_order_status_change();

-- Commento per documentare il sistema di tracciamento
COMMENT ON FUNCTION track_work_order_status_change() IS 
  'Traccia automaticamente i cambi di stato degli ordini di produzione creando esecuzioni. 
  Ogni cambio di stato completa l''esecuzione precedente e ne crea una nuova.
  Stati: to_do → in_lavorazione → test → pronti → spediti_consegnati';