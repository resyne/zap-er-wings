-- Migrate existing work order statuses to new values
UPDATE work_orders
SET status = CASE status::text
  WHEN 'to_do' THEN 'da_fare'::wo_status
  WHEN 'test' THEN 'in_test'::wo_status
  WHEN 'pronti' THEN 'pronto'::wo_status
  WHEN 'spediti_consegnati' THEN 'completato'::wo_status
  WHEN 'completed' THEN 'completato'::wo_status
  WHEN 'closed' THEN 'completato'::wo_status
  ELSE status
END
WHERE status::text IN ('to_do', 'test', 'pronti', 'spediti_consegnati', 'completed', 'closed');

-- Update default value to use new status
ALTER TABLE work_orders ALTER COLUMN status SET DEFAULT 'da_fare'::wo_status;