-- Update existing work orders to set planned_start_date to created_at
UPDATE work_orders 
SET planned_start_date = created_at::timestamptz
WHERE planned_start_date IS NULL OR planned_start_date != created_at::timestamptz;

-- Create or replace function to automatically set planned_start_date on insert
CREATE OR REPLACE FUNCTION set_work_order_planned_start_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Set planned_start_date to created_at if not explicitly provided
  IF NEW.planned_start_date IS NULL THEN
    NEW.planned_start_date := NEW.created_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_set_work_order_planned_start_date ON work_orders;

CREATE TRIGGER trigger_set_work_order_planned_start_date
  BEFORE INSERT ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_work_order_planned_start_date();