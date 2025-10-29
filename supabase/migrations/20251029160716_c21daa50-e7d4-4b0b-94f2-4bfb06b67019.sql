-- Add offer_id column to work_orders table
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES offers(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_work_orders_offer_id ON work_orders(offer_id);