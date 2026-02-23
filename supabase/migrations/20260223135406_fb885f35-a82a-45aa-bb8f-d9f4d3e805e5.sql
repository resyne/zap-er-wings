
-- Add invoicing fields to service_reports
ALTER TABLE public.service_reports
ADD COLUMN IF NOT EXISTS invoiced boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS invoice_number text,
ADD COLUMN IF NOT EXISTS invoice_date date,
ADD COLUMN IF NOT EXISTS customer_invoice_id uuid REFERENCES public.customer_invoices(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.service_reports.invoiced IS 'Whether this report has been invoiced';
COMMENT ON COLUMN public.service_reports.customer_invoice_id IS 'Link to customer_invoices (scadenziario)';

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_service_reports_customer_invoice_id ON public.service_reports(customer_invoice_id);
CREATE INDEX IF NOT EXISTS idx_service_reports_invoiced ON public.service_reports(invoiced);
