-- Add incomplete_registry column to customers table
ALTER TABLE public.customers 
ADD COLUMN incomplete_registry boolean DEFAULT false;