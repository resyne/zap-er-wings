-- Add assigned_to field to shipping_orders
ALTER TABLE shipping_orders 
ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES profiles(id);

-- Add status tracking fields
ALTER TABLE shipping_orders
ADD COLUMN IF NOT EXISTS status_changed_by uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS status_changed_at timestamp with time zone;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_shipping_orders_assigned_to ON shipping_orders(assigned_to);
CREATE INDEX IF NOT EXISTS idx_shipping_orders_status_changed_by ON shipping_orders(status_changed_by);