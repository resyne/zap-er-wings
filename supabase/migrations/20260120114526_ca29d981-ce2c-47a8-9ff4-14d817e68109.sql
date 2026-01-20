-- Fix existing leads created from phone calls that don't have pipeline set
UPDATE public.leads 
SET pipeline = 'Zapper' 
WHERE source = 'phone_call' 
  AND (pipeline IS NULL OR pipeline = '');