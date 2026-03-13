ALTER TABLE public.invoice_registry
ADD COLUMN IF NOT EXISTS attachment_url text;