
-- Storage bucket for accounting documents
INSERT INTO storage.buckets (id, name, public) VALUES ('accounting-documents', 'accounting-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Authenticated users can upload accounting docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'accounting-documents');

CREATE POLICY "Authenticated users can view accounting docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'accounting-documents');

CREATE POLICY "Authenticated users can delete accounting docs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'accounting-documents');

-- Table for accounting documents (parsed invoices)
CREATE TABLE public.accounting_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL CHECK (document_type IN ('fattura_vendita', 'fattura_acquisto', 'nota_credito')),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  
  -- Extracted data
  invoice_number TEXT,
  invoice_date DATE,
  due_date DATE,
  
  -- Amounts
  net_amount NUMERIC(12,2),
  vat_rate NUMERIC(5,2),
  vat_amount NUMERIC(12,2),
  total_amount NUMERIC(12,2),
  
  -- Customer/Supplier
  customer_id UUID REFERENCES public.customers(id),
  counterpart_name TEXT,
  counterpart_vat TEXT,
  counterpart_address TEXT,
  
  -- AI processing
  ai_confidence NUMERIC(3,2),
  ai_raw_data JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  
  -- Prima nota link
  accounting_entry_id UUID REFERENCES public.accounting_entries(id),
  
  -- Metadata
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.accounting_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage accounting documents"
ON public.accounting_documents FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER set_accounting_documents_updated_at
  BEFORE UPDATE ON public.accounting_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
