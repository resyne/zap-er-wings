
-- Bank movements table (immutable after import)
CREATE TABLE public.bank_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_batch_id UUID NOT NULL DEFAULT gen_random_uuid(),
  movement_date DATE NOT NULL,
  value_date DATE,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  direction TEXT NOT NULL DEFAULT 'inflow' CHECK (direction IN ('inflow', 'outflow')),
  bank_account TEXT,
  iban TEXT,
  reference TEXT,
  raw_data JSONB,
  status TEXT NOT NULL DEFAULT 'unmatched' CHECK (status IN ('unmatched', 'suggested', 'matched', 'partial', 'ignored')),
  matched_subject_name TEXT,
  matched_subject_id UUID,
  imported_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bank reconciliation links (movement <-> invoice/scadenza)
CREATE TABLE public.bank_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_movement_id UUID NOT NULL REFERENCES public.bank_movements(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoice_registry(id),
  scadenza_id UUID REFERENCES public.scadenze(id),
  prima_nota_id UUID REFERENCES public.prima_nota(id),
  reconciled_amount NUMERIC(12,2) NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'manual' CHECK (match_type IN ('auto', 'suggested', 'manual')),
  match_score NUMERIC(5,2),
  notes TEXT,
  reconciled_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bank_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;

-- RLS policies for bank_movements
CREATE POLICY "Authenticated users can view bank movements" ON public.bank_movements
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert bank movements" ON public.bank_movements
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Only admins can update bank movements" ON public.bank_movements
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete bank movements" ON public.bank_movements
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for bank_reconciliations
CREATE POLICY "Authenticated users can view reconciliations" ON public.bank_reconciliations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert reconciliations" ON public.bank_reconciliations
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update reconciliations" ON public.bank_reconciliations
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Only admins can delete reconciliations" ON public.bank_reconciliations
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_bank_movements_direction ON public.bank_movements(direction);
CREATE INDEX idx_bank_movements_status ON public.bank_movements(status);
CREATE INDEX idx_bank_movements_date ON public.bank_movements(movement_date);
CREATE INDEX idx_bank_reconciliations_movement ON public.bank_reconciliations(bank_movement_id);
CREATE INDEX idx_bank_reconciliations_invoice ON public.bank_reconciliations(invoice_id);

-- Updated_at trigger
CREATE TRIGGER set_bank_movements_updated_at
  BEFORE UPDATE ON public.bank_movements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
