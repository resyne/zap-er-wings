-- Update all pre-qualified leads to ZAPPER pipeline
UPDATE public.leads 
SET pipeline = 'zapper' 
WHERE pre_qualificato = true AND (pipeline IS NULL OR pipeline = '');