-- Add archived column to sales_orders table
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;