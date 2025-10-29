-- Add pec and sdi_code columns to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS pec text,
ADD COLUMN IF NOT EXISTS sdi_code text;