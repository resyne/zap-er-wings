
-- Tabella per tracciare gli abbuoni (write-offs) che necessitano di note credito
CREATE TABLE public.abbuoni (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scadenza_id UUID NOT NULL REFERENCES public.scadenze(id) ON DELETE CASCADE,
  importo NUMERIC(12,2) NOT NULL,
  motivo TEXT,
  nota_credito_emessa BOOLEAN DEFAULT false,
  nota_credito_id UUID REFERENCES public.invoice_registry(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_abbuoni_scadenza ON public.abbuoni(scadenza_id);
CREATE INDEX idx_abbuoni_nota_credito ON public.abbuoni(nota_credito_emessa);

ALTER TABLE public.abbuoni ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can do all" ON public.abbuoni
  FOR ALL USING (auth.uid() IS NOT NULL);
