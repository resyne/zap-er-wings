-- Add customer_id column to service_reports table for CRM customers link
ALTER TABLE public.service_reports 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_service_reports_customer_id ON public.service_reports(customer_id);