-- Aggiorna gli ordini esistenti da 'planned' a 'to_do'
UPDATE work_orders 
SET status = 'to_do'::wo_status
WHERE status = 'planned'::wo_status;