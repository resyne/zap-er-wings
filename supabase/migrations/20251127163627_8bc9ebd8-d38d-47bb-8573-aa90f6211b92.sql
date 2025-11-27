-- Add archived field to purchase_orders table
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_purchase_orders_archived 
ON purchase_orders(archived);