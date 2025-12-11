-- Add product_name column to offer_items table
ALTER TABLE public.offer_items 
ADD COLUMN IF NOT EXISTS product_name text;