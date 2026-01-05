-- Add city field to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS city TEXT;