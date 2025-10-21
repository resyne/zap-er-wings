-- Elimina tutte le email di follow-up automatiche ancora in coda
DELETE FROM email_queue 
WHERE status = 'pending' 
  AND metadata->>'automation_id' IS NOT NULL 
  AND scheduled_at > now();