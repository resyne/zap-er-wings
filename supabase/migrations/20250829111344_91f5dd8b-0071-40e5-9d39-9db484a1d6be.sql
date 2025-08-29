-- Add company name and shipping address fields to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS shipping_address TEXT;