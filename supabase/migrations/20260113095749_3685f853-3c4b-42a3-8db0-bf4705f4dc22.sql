-- Prima, aggiorna i call_records per puntare al lead originale invece dei duplicati
WITH duplicates AS (
  SELECT phone, MIN(created_at) as first_created
  FROM leads
  WHERE pre_qualificato = true AND status = 'new'
  AND phone IN ('+447484814364', '08119968436', '+393802375325', '+447596766663', '+447799264806')
  GROUP BY phone
),
leads_to_keep AS (
  SELECT l.id, l.phone
  FROM leads l
  JOIN duplicates d ON l.phone = d.phone AND l.created_at = d.first_created
)
UPDATE call_records cr
SET lead_id = ltk.id
FROM leads_to_keep ltk
JOIN leads dup_leads ON dup_leads.phone = ltk.phone
WHERE cr.lead_id = dup_leads.id AND cr.lead_id != ltk.id;

-- Poi elimina i lead duplicati (mantenendo il primo creato per ogni telefono)
WITH duplicates AS (
  SELECT phone, MIN(created_at) as first_created
  FROM leads
  WHERE pre_qualificato = true AND status = 'new'
  AND phone IN ('+447484814364', '08119968436', '+393802375325', '+447596766663', '+447799264806')
  GROUP BY phone
),
leads_to_keep AS (
  SELECT l.id
  FROM leads l
  JOIN duplicates d ON l.phone = d.phone AND l.created_at = d.first_created
)
DELETE FROM leads 
WHERE pre_qualificato = true AND status = 'new'
AND phone IN ('+447484814364', '08119968436', '+393802375325', '+447596766663', '+447799264806')
AND id NOT IN (SELECT id FROM leads_to_keep);