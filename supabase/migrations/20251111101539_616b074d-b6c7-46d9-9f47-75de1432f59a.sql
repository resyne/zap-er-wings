-- Add created_by column to leads table to track who created each lead
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_leads_created_by ON public.leads(created_by);