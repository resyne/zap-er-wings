-- Fix existing leads created from phone calls that don't have pre_qualificato set
UPDATE public.leads 
SET pre_qualificato = true 
WHERE source = 'phone_call' 
  AND (pre_qualificato IS NULL OR pre_qualificato = false);