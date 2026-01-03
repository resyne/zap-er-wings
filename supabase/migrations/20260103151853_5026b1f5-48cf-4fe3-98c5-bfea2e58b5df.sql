-- Registro Fatture unificato
CREATE TABLE public.invoice_registry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Identità
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  invoice_type TEXT NOT NULL CHECK (invoice_type IN ('vendita', 'acquisto', 'nota_credito')),
  
  -- Soggetto
  subject_type TEXT NOT NULL CHECK (subject_type IN ('cliente', 'fornitore')),
  subject_id UUID,
  subject_name TEXT NOT NULL,
  
  -- Importi
  imponibile NUMERIC NOT NULL DEFAULT 0,
  iva_rate NUMERIC NOT NULL DEFAULT 22,
  iva_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  
  -- Regime IVA
  vat_regime TEXT NOT NULL DEFAULT 'domestica_imponibile' CHECK (vat_regime IN ('domestica_imponibile', 'ue_non_imponibile', 'extra_ue', 'reverse_charge')),
  
  -- Stato documento
  status TEXT NOT NULL DEFAULT 'bozza' CHECK (status IN ('bozza', 'registrata')),
  
  -- Stato finanziario (previsione)
  financial_status TEXT NOT NULL DEFAULT 'da_incassare' CHECK (financial_status IN ('da_incassare', 'da_pagare', 'incassata', 'pagata')),
  
  -- Date finanziarie
  due_date DATE,
  payment_date DATE,
  
  -- Collegamenti
  source_document_type TEXT, -- 'ordine', 'ddt', 'rapporto'
  source_document_id UUID,
  accounting_entry_id UUID REFERENCES public.accounting_entries(id),
  scadenza_id UUID REFERENCES public.scadenze(id),
  prima_nota_id UUID REFERENCES public.prima_nota(id),
  
  -- Note
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  registered_at TIMESTAMP WITH TIME ZONE,
  registered_by UUID
);

-- Enable RLS
ALTER TABLE public.invoice_registry ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view invoice registry"
ON public.invoice_registry FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert invoice registry"
ON public.invoice_registry FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update invoice registry"
ON public.invoice_registry FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete invoice registry"
ON public.invoice_registry FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Indexes
CREATE INDEX idx_invoice_registry_status ON public.invoice_registry(status);
CREATE INDEX idx_invoice_registry_type ON public.invoice_registry(invoice_type);
CREATE INDEX idx_invoice_registry_financial_status ON public.invoice_registry(financial_status);
CREATE INDEX idx_invoice_registry_date ON public.invoice_registry(invoice_date);
CREATE INDEX idx_invoice_registry_source ON public.invoice_registry(source_document_type, source_document_id);

-- Trigger per updated_at
CREATE TRIGGER update_invoice_registry_updated_at
BEFORE UPDATE ON public.invoice_registry
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();