-- Tabella scadenze
CREATE TABLE public.scadenze (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id UUID REFERENCES public.accounting_entries(id) ON DELETE CASCADE,
  prima_nota_id UUID REFERENCES public.prima_nota(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('credito', 'debito')),
  soggetto_tipo TEXT CHECK (soggetto_tipo IN ('cliente', 'fornitore')),
  soggetto_nome TEXT,
  soggetto_id UUID,
  data_documento DATE NOT NULL,
  data_scadenza DATE NOT NULL,
  importo_totale NUMERIC(15,2) NOT NULL,
  importo_residuo NUMERIC(15,2) NOT NULL,
  stato TEXT NOT NULL DEFAULT 'aperta' CHECK (stato IN ('aperta', 'parziale', 'chiusa')),
  iva_mode TEXT,
  conto_economico TEXT,
  centro_id UUID,
  termini_pagamento INTEGER DEFAULT 30,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabella per storico incassi/pagamenti collegati alle scadenze
CREATE TABLE public.scadenza_movimenti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scadenza_id UUID NOT NULL REFERENCES public.scadenze(id) ON DELETE CASCADE,
  evento_finanziario_id UUID REFERENCES public.accounting_entries(id) ON DELETE SET NULL,
  prima_nota_id UUID REFERENCES public.prima_nota(id) ON DELETE SET NULL,
  importo NUMERIC(15,2) NOT NULL,
  data_movimento DATE NOT NULL,
  metodo_pagamento TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indici per performance
CREATE INDEX idx_scadenze_evento ON public.scadenze(evento_id);
CREATE INDEX idx_scadenze_stato ON public.scadenze(stato);
CREATE INDEX idx_scadenze_data_scadenza ON public.scadenze(data_scadenza);
CREATE INDEX idx_scadenze_tipo ON public.scadenze(tipo);
CREATE INDEX idx_scadenza_movimenti_scadenza ON public.scadenza_movimenti(scadenza_id);

-- RLS
ALTER TABLE public.scadenze ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scadenza_movimenti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON public.scadenze
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all for authenticated users" ON public.scadenza_movimenti
  FOR ALL USING (auth.role() = 'authenticated');

-- Trigger per updated_at
CREATE TRIGGER set_scadenze_updated_at
  BEFORE UPDATE ON public.scadenze
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Funzione per creare scadenza automaticamente da evento
CREATE OR REPLACE FUNCTION public.create_scadenza_from_evento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tipo TEXT;
  v_termini INTEGER := 30;
  v_data_scadenza DATE;
BEGIN
  -- Solo se incide sul CE e ha stato finanziario da_incassare o da_pagare
  IF NEW.affects_income_statement = true 
     AND NEW.financial_status IN ('da_incassare', 'da_pagare') 
     AND NEW.totale IS NOT NULL 
     AND NEW.totale > 0 THEN
    
    -- Determina tipo scadenza
    IF NEW.direction = 'entrata' THEN
      v_tipo := 'credito';
    ELSE
      v_tipo := 'debito';
    END IF;
    
    -- Calcola data scadenza
    v_data_scadenza := NEW.document_date::date + (v_termini || ' days')::interval;
    
    -- Crea la scadenza
    INSERT INTO public.scadenze (
      evento_id,
      tipo,
      soggetto_tipo,
      soggetto_nome,
      soggetto_id,
      data_documento,
      data_scadenza,
      importo_totale,
      importo_residuo,
      stato,
      iva_mode,
      conto_economico,
      centro_id,
      termini_pagamento
    ) VALUES (
      NEW.id,
      v_tipo,
      NEW.subject_type,
      NULL, -- soggetto_nome da popolare se disponibile
      NEW.economic_subject_id,
      NEW.document_date::date,
      v_data_scadenza,
      NEW.totale,
      NEW.totale,
      'aperta',
      NEW.iva_mode,
      NEW.account_code,
      COALESCE(NEW.cost_center_id, NEW.profit_center_id),
      v_termini
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger per creare scadenza automaticamente
CREATE TRIGGER trigger_create_scadenza_from_evento
  AFTER INSERT ON public.accounting_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.create_scadenza_from_evento();