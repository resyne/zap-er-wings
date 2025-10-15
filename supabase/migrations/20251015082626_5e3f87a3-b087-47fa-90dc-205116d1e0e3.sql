-- Add custom_fields column to leads table
ALTER TABLE public.leads 
ADD COLUMN custom_fields JSONB DEFAULT '{}'::jsonb;