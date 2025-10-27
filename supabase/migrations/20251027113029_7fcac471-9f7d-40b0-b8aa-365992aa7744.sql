-- Rendi opzionali le firme nella tabella service_reports per permettere la creazione di rapporti in bozza
ALTER TABLE public.service_reports 
ALTER COLUMN customer_signature DROP NOT NULL,
ALTER COLUMN technician_signature DROP NOT NULL,
ALTER COLUMN technician_name DROP NOT NULL;

-- Aggiungi il valore di default per lo status se non esiste
ALTER TABLE public.service_reports 
ALTER COLUMN status SET DEFAULT 'in_progress';