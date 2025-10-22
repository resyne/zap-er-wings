-- Add article field to sales_orders table
ALTER TABLE sales_orders 
ADD COLUMN IF NOT EXISTS article TEXT;

-- Add responsible users for production work orders
ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS production_responsible_id UUID REFERENCES auth.users(id);

-- Add responsible users for service work orders  
ALTER TABLE service_work_orders
ADD COLUMN IF NOT EXISTS service_responsible_id UUID REFERENCES auth.users(id);

-- Add responsible users for shipping orders
ALTER TABLE shipping_orders
ADD COLUMN IF NOT EXISTS shipping_responsible_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS back_office_responsible_id UUID REFERENCES auth.users(id);