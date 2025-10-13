-- Add lead_id column to sales_orders if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sales_orders' AND column_name = 'lead_id'
    ) THEN
        ALTER TABLE sales_orders ADD COLUMN lead_id uuid REFERENCES leads(id);
    END IF;
END $$;

-- Add lead_id column to work_orders if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'work_orders' AND column_name = 'lead_id'
    ) THEN
        ALTER TABLE work_orders ADD COLUMN lead_id uuid REFERENCES leads(id);
    END IF;
END $$;