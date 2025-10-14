-- Add country and archived fields to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Italia',
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;

-- Add index for better filtering performance
CREATE INDEX IF NOT EXISTS idx_leads_country ON public.leads(country);
CREATE INDEX IF NOT EXISTS idx_leads_archived ON public.leads(archived);