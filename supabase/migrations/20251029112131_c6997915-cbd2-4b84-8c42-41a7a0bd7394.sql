-- Drop the old foreign key constraint if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'work_orders_assigned_to_technician_fkey'
  ) THEN
    ALTER TABLE work_orders DROP CONSTRAINT work_orders_assigned_to_technician_fkey;
  END IF;
END $$;

-- Set assigned_to to NULL for records where the user doesn't exist in profiles
UPDATE work_orders 
SET assigned_to = NULL
WHERE assigned_to IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = work_orders.assigned_to
  );

-- Same for back_office_manager
UPDATE work_orders 
SET back_office_manager = NULL
WHERE back_office_manager IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = work_orders.back_office_manager
  );

-- Now add the correct foreign key constraints if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'work_orders_assigned_to_fkey'
  ) THEN
    ALTER TABLE work_orders 
    ADD CONSTRAINT work_orders_assigned_to_fkey 
    FOREIGN KEY (assigned_to) 
    REFERENCES profiles(id) 
    ON DELETE SET NULL;
  END IF;
END $$;