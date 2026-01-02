-- Tabella Prima Nota
CREATE TABLE public.prima_nota (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Collegamento all'evento origine (FONDAMENTALE)
  accounting_entry_id UUID NOT NULL REFERENCES public.accounting_entries(id),
  
  -- Tipo di movimento
  movement_type TEXT NOT NULL CHECK (movement_type IN ('economico', 'finanziario')),
  
  -- Data competenza (NON data documento!)
  competence_date DATE NOT NULL,
  
  -- Importo (positivo = entrata/ricavo, negativo = uscita/costo)
  amount NUMERIC NOT NULL,
  
  -- Piano dei Conti (NATURA) - solo per movimenti economici
  chart_account_id UUID REFERENCES public.chart_of_accounts(id),
  
  -- Centri (ORIGINE) - ereditati dall'evento
  cost_center_id UUID REFERENCES public.cost_centers(id),
  profit_center_id UUID REFERENCES public.profit_centers(id),
  center_percentage NUMERIC DEFAULT 100,
  
  -- Descrizione movimento
  description TEXT,
  
  -- Numero progressivo per competenza rateizzata (es: 1/12, 2/12...)
  installment_number INTEGER,
  total_installments INTEGER,
  
  -- Stati del movimento
  status TEXT NOT NULL DEFAULT 'generato' CHECK (status IN ('generato', 'registrato', 'bloccato', 'rettificato')),
  
  -- Rettifica (mai cancellare, solo rettificare)
  rectified_by UUID REFERENCES public.prima_nota(id),
  rectification_reason TEXT,
  is_rectification BOOLEAN DEFAULT false,
  original_movement_id UUID REFERENCES public.prima_nota(id),
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  registered_at TIMESTAMP WITH TIME ZONE,
  registered_by UUID,
  blocked_at TIMESTAMP WITH TIME ZONE,
  
  -- Periodo contabile
  accounting_period TEXT -- formato: YYYY-MM
);

-- Indici per performance
CREATE INDEX idx_prima_nota_entry ON public.prima_nota(accounting_entry_id);
CREATE INDEX idx_prima_nota_date ON public.prima_nota(competence_date);
CREATE INDEX idx_prima_nota_period ON public.prima_nota(accounting_period);
CREATE INDEX idx_prima_nota_status ON public.prima_nota(status);
CREATE INDEX idx_prima_nota_chart_account ON public.prima_nota(chart_account_id);
CREATE INDEX idx_prima_nota_cost_center ON public.prima_nota(cost_center_id);
CREATE INDEX idx_prima_nota_profit_center ON public.prima_nota(profit_center_id);

-- Trigger per impostare automaticamente il periodo contabile
CREATE OR REPLACE FUNCTION public.set_accounting_period()
RETURNS TRIGGER AS $$
BEGIN
  NEW.accounting_period := TO_CHAR(NEW.competence_date, 'YYYY-MM');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER set_prima_nota_period
  BEFORE INSERT OR UPDATE ON public.prima_nota
  FOR EACH ROW
  EXECUTE FUNCTION public.set_accounting_period();

-- Enable RLS
ALTER TABLE public.prima_nota ENABLE ROW LEVEL SECURITY;

-- Policy permissiva per utenti autenticati (da raffinare in base ai ruoli)
CREATE POLICY "Authenticated users can view prima_nota"
  ON public.prima_nota FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert prima_nota"
  ON public.prima_nota FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update prima_nota"
  ON public.prima_nota FOR UPDATE
  TO authenticated
  USING (true);

-- Commenti per documentazione
COMMENT ON TABLE public.prima_nota IS 'Movimenti di Prima Nota generati dagli Eventi classificati';
COMMENT ON COLUMN public.prima_nota.accounting_entry_id IS 'Evento origine - la PN nasce SOLO da eventi classificati';
COMMENT ON COLUMN public.prima_nota.competence_date IS 'Data di COMPETENZA, non di documento o pagamento';
COMMENT ON COLUMN public.prima_nota.movement_type IS 'economico = incide su C/E, finanziario = solo cash flow';
COMMENT ON COLUMN public.prima_nota.rectified_by IS 'Se rettificato, punta al movimento che lo rettifica';
COMMENT ON COLUMN public.prima_nota.is_rectification IS 'Se true, questo movimento è una rettifica di un altro';