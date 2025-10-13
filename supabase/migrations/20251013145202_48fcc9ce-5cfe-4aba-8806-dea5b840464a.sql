-- Aggiungiamo gli stati mancanti agli enum
DO $$ 
BEGIN
  -- Per wo_status (work_orders)
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'in_lavorazione' AND enumtypid = 'wo_status'::regtype) THEN
    ALTER TYPE wo_status ADD VALUE 'in_lavorazione';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'in_corso' AND enumtypid = 'wo_status'::regtype) THEN
    ALTER TYPE wo_status ADD VALUE 'in_corso';
  END IF;
END $$;