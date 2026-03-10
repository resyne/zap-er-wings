
-- Add pre_movement_status to accounting_entries
ALTER TABLE public.accounting_entries 
  ADD COLUMN IF NOT EXISTS pre_movement_status text DEFAULT NULL;

-- Create pre_movement_links table to associate receipts with summary invoices
CREATE TABLE IF NOT EXISTS public.pre_movement_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pre_movement_id uuid NOT NULL REFERENCES public.accounting_entries(id) ON DELETE CASCADE,
  invoice_entry_id uuid REFERENCES public.accounting_entries(id) ON DELETE SET NULL,
  invoice_document_id uuid REFERENCES public.accounting_documents(id) ON DELETE SET NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  linked_by uuid REFERENCES auth.users(id),
  notes text
);

-- Enable RLS
ALTER TABLE public.pre_movement_links ENABLE ROW LEVEL SECURITY;

-- RLS policies for pre_movement_links
CREATE POLICY "Authenticated users can view pre_movement_links" 
  ON public.pre_movement_links FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert pre_movement_links" 
  ON public.pre_movement_links FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update pre_movement_links" 
  ON public.pre_movement_links FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete pre_movement_links" 
  ON public.pre_movement_links FOR DELETE TO authenticated USING (true);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_pre_movement_links_pre_movement_id ON public.pre_movement_links(pre_movement_id);
CREATE INDEX IF NOT EXISTS idx_pre_movement_links_invoice_entry_id ON public.pre_movement_links(invoice_entry_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_pre_movement_status ON public.accounting_entries(pre_movement_status) WHERE pre_movement_status IS NOT NULL;

COMMENT ON COLUMN public.accounting_entries.pre_movement_status IS 'Pre-movement status: in_attesa_fattura (waiting for summary invoice), consolidato (linked to invoice)';
COMMENT ON TABLE public.pre_movement_links IS 'Links pre-movements (receipts) to their consolidating invoice entries';
