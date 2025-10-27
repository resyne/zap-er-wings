-- Aggiorna gli stati delle service_work_orders con approccio corretto
-- Step 1: Rimuove completamente il constraint esistente
ALTER TABLE service_work_orders DROP CONSTRAINT IF EXISTS service_work_orders_status_check;

-- Step 2: Imposta il valore di default temporaneamente
ALTER TABLE service_work_orders ALTER COLUMN status DROP DEFAULT;

-- Step 3: Aggiorna tutti gli stati esistenti
UPDATE service_work_orders 
SET status = CASE
  WHEN status = 'to_do' THEN 'da_programmare'
  WHEN status IN ('in_lavorazione', 'test', 'pronti') THEN 'programmata'
  WHEN status = 'spediti_consegnati' THEN 'completata'
  ELSE 'da_programmare'
END;

-- Step 4: Imposta il nuovo valore di default
ALTER TABLE service_work_orders ALTER COLUMN status SET DEFAULT 'da_programmare';

-- Step 5: Aggiungi il nuovo constraint con i nuovi stati
ALTER TABLE service_work_orders
ADD CONSTRAINT service_work_orders_status_check 
CHECK (status IN ('da_programmare', 'programmata', 'completata'));