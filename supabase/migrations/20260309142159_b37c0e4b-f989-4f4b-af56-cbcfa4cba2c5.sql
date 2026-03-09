
-- Tabella di collegamento giustificativi ↔ documenti contabili
CREATE TABLE public.document_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Documento contabile (fattura vendita/acquisto, nota di credito)
  document_type TEXT NOT NULL CHECK (document_type IN ('fattura_vendita', 'fattura_acquisto', 'nota_credito')),
  document_id UUID NOT NULL,
  -- Giustificativo collegato
  justification_type TEXT NOT NULL CHECK (justification_type IN ('rapporto_intervento', 'ddt', 'scontrino', 'preventivo', 'ordine_acquisto', 'foto', 'altro')),
  justification_id UUID,
  justification_url TEXT,
  justification_name TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.document_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view document_links"
  ON public.document_links FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert document_links"
  ON public.document_links FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete own document_links"
  ON public.document_links FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.is_admin_user());

-- Tabelle documenti contabili
CREATE TABLE public.sales_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id UUID REFERENCES public.customers(id),
  customer_name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  payment_status TEXT NOT NULL DEFAULT 'da_incassare' CHECK (payment_status IN ('da_incassare', 'incassata', 'parziale')),
  due_date DATE,
  notes TEXT,
  attachment_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_name TEXT NOT NULL,
  supplier_id UUID,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  payment_status TEXT NOT NULL DEFAULT 'da_pagare' CHECK (payment_status IN ('da_pagare', 'pagata', 'parziale')),
  due_date DATE,
  notes TEXT,
  attachment_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_number TEXT NOT NULL,
  note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  direction TEXT NOT NULL DEFAULT 'emessa' CHECK (direction IN ('emessa', 'ricevuta')),
  related_invoice_id UUID,
  related_invoice_type TEXT CHECK (related_invoice_type IN ('fattura_vendita', 'fattura_acquisto')),
  subject_name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  reason TEXT,
  notes TEXT,
  attachment_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS per le nuove tabelle
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can manage sales_invoices" ON public.sales_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users can manage purchase_invoices" ON public.purchase_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users can manage credit_notes" ON public.credit_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE TRIGGER set_sales_invoices_updated_at BEFORE UPDATE ON public.sales_invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_purchase_invoices_updated_at BEFORE UPDATE ON public.purchase_invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_credit_notes_updated_at BEFORE UPDATE ON public.credit_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
