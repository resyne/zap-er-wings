-- Add customer_id to leads table to link leads with customers
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_leads_customer_id ON public.leads(customer_id);