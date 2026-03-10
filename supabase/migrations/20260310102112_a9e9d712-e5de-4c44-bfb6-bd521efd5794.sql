
-- Add accounting_document_id and non_contabilizzato to operational document tables
ALTER TABLE public.ddts 
  ADD COLUMN IF NOT EXISTS accounting_document_id uuid REFERENCES public.accounting_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS non_contabilizzato boolean NOT NULL DEFAULT false;

ALTER TABLE public.sales_orders 
  ADD COLUMN IF NOT EXISTS accounting_document_id uuid REFERENCES public.accounting_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS non_contabilizzato boolean NOT NULL DEFAULT false;

ALTER TABLE public.service_reports 
  ADD COLUMN IF NOT EXISTS accounting_document_id uuid REFERENCES public.accounting_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS non_contabilizzato boolean NOT NULL DEFAULT false;
