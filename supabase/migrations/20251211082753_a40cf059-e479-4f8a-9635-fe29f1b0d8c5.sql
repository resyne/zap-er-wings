-- Add priority column to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS priority text DEFAULT 'media';

-- Add comment for documentation
COMMENT ON COLUMN public.leads.priority IS 'Lead priority: bassa, media, alta, urgente';