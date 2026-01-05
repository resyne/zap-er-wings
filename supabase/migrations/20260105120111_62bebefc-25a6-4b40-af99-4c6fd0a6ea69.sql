-- Drop the old check constraint first
ALTER TABLE service_work_orders DROP CONSTRAINT IF EXISTS service_work_orders_status_check;

-- Update existing statuses to the new simplified statuses BEFORE adding constraint
UPDATE service_work_orders 
SET status = 'da_fare' 
WHERE status IN ('programmata', 'da_programmare');

-- Now add the new check constraint with simplified statuses
ALTER TABLE service_work_orders ADD CONSTRAINT service_work_orders_status_check 
CHECK (status = ANY (ARRAY['da_fare'::text, 'stand_by'::text, 'completata'::text]));