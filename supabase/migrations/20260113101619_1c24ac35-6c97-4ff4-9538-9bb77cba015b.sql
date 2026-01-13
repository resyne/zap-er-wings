-- Elimina i lead creati automaticamente dalle chiamate che non hanno più call_records associati
DELETE FROM public.leads
WHERE source = 'phone_call'
  AND id NOT IN (
    SELECT DISTINCT lead_id FROM public.call_records WHERE lead_id IS NOT NULL
  );