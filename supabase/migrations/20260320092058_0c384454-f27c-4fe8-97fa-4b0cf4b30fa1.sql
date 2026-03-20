-- Add payment_amount and payment_method columns to service_reports for receipt functionality
ALTER TABLE public.service_reports 
  ADD COLUMN IF NOT EXISTS payment_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT null,
  ADD COLUMN IF NOT EXISTS payment_notes text DEFAULT null;

-- Add check constraint for payment_method
ALTER TABLE public.service_reports
  ADD CONSTRAINT service_reports_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('contanti', 'carta', 'bonifico', 'assegno', 'altro'));