-- Migrate remaining old statuses to new ones
UPDATE work_orders
SET status = CASE status::text
  WHEN 'planned' THEN 'da_fare'::wo_status
  WHEN 'in_progress' THEN 'in_lavorazione'::wo_status
  WHEN 'testing' THEN 'in_test'::wo_status
  WHEN 'closed' THEN 'completato'::wo_status
  ELSE status
END
WHERE status::text IN ('planned', 'in_progress', 'testing', 'closed');