-- Add shipping location fields to shipping_orders table
ALTER TABLE public.shipping_orders 
ADD COLUMN IF NOT EXISTS shipping_city TEXT,
ADD COLUMN IF NOT EXISTS shipping_country TEXT,
ADD COLUMN IF NOT EXISTS shipping_province TEXT,
ADD COLUMN IF NOT EXISTS shipping_postal_code TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_shipping_orders_country ON public.shipping_orders(shipping_country);
CREATE INDEX IF NOT EXISTS idx_shipping_orders_city ON public.shipping_orders(shipping_city);

-- Add missing fields to customers table if they don't exist
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS province TEXT,
ADD COLUMN IF NOT EXISTS postal_code TEXT;