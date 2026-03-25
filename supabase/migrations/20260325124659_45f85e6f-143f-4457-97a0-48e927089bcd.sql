
-- Bridge table for many-to-many invoice <-> operational document links
CREATE TABLE public.invoice_document_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoice_registry(id) ON DELETE CASCADE,
  document_id UUID NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('sales_order', 'ddt', 'service_report')),
  linked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  linked_by UUID REFERENCES auth.users(id),
  notes TEXT,
  UNIQUE(invoice_id, document_id, document_type)
);

-- Index for fast lookups
CREATE INDEX idx_invoice_document_links_invoice ON public.invoice_document_links(invoice_id);
CREATE INDEX idx_invoice_document_links_document ON public.invoice_document_links(document_id, document_type);

-- RLS
ALTER TABLE public.invoice_document_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage invoice document links"
ON public.invoice_document_links
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
