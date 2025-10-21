-- Add payment on delivery fields to work_orders table
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS payment_on_delivery boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS payment_amount numeric(10,2);

-- Add payment on delivery fields to shipping_orders table
ALTER TABLE shipping_orders
ADD COLUMN IF NOT EXISTS payment_on_delivery boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS payment_amount numeric(10,2);

-- Make customer_id nullable in shipping_orders if not already
ALTER TABLE shipping_orders
ALTER COLUMN customer_id DROP NOT NULL;