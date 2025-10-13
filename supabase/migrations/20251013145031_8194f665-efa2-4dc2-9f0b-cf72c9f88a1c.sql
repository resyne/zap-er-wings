-- Prima aggiungiamo i nuovi valori all'enum (devono essere committati prima dell'uso)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'to_do' AND enumtypid = 'wo_status'::regtype) THEN
    ALTER TYPE wo_status ADD VALUE 'to_do';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'completed' AND enumtypid = 'wo_status'::regtype) THEN
    ALTER TYPE wo_status ADD VALUE 'completed';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'completato' AND enumtypid = 'wo_status'::regtype) THEN
    ALTER TYPE wo_status ADD VALUE 'completato';
  END IF;
END $$;