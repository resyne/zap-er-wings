-- =====================================================
-- FIX 3 & 8: Aggiungere campi IVA e migliorare struttura
-- =====================================================

-- Aggiungi campi IVA a accounting_entries (se non esistono)
ALTER TABLE public.accounting_entries 
ADD COLUMN IF NOT EXISTS iva_mode text;

ALTER TABLE public.accounting_entries 
ADD COLUMN IF NOT EXISTS iva_aliquota numeric DEFAULT 22;

ALTER TABLE public.accounting_entries 
ADD COLUMN IF NOT EXISTS imponibile numeric;

ALTER TABLE public.accounting_entries 
ADD COLUMN IF NOT EXISTS iva_amount numeric DEFAULT 0;

ALTER TABLE public.accounting_entries 
ADD COLUMN IF NOT EXISTS totale numeric;

-- =====================================================
-- FIX 1: Creare tabella per righe contabili (partita doppia)
-- =====================================================

-- Tabella per le righe contabili di ogni movimento (partita doppia)
CREATE TABLE IF NOT EXISTS public.prima_nota_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prima_nota_id uuid NOT NULL REFERENCES public.prima_nota(id) ON DELETE CASCADE,
  line_order integer NOT NULL DEFAULT 1,
  -- Conto
  chart_account_id uuid REFERENCES public.chart_of_accounts(id),
  structural_account_id uuid REFERENCES public.structural_accounts(id),
  account_type text NOT NULL, -- 'chart' | 'structural' | 'dynamic'
  dynamic_account_key text, -- es: BANCA, CASSA, CREDITI_CLIENTI, IVA_DEBITO, etc.
  -- Dare/Avere
  dare numeric NOT NULL DEFAULT 0,
  avere numeric NOT NULL DEFAULT 0,
  -- Descrizione riga
  description text,
  -- Metadata
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indice per velocizzare le query
CREATE INDEX IF NOT EXISTS idx_prima_nota_lines_prima_nota_id ON public.prima_nota_lines(prima_nota_id);

-- Aggiungi colonne IVA a prima_nota per riferimento rapido
ALTER TABLE public.prima_nota 
ADD COLUMN IF NOT EXISTS iva_mode text;

ALTER TABLE public.prima_nota 
ADD COLUMN IF NOT EXISTS iva_aliquota numeric;

ALTER TABLE public.prima_nota 
ADD COLUMN IF NOT EXISTS imponibile numeric;

ALTER TABLE public.prima_nota 
ADD COLUMN IF NOT EXISTS iva_amount numeric;

ALTER TABLE public.prima_nota 
ADD COLUMN IF NOT EXISTS totale numeric;

ALTER TABLE public.prima_nota 
ADD COLUMN IF NOT EXISTS payment_method text;

-- RLS per prima_nota_lines
ALTER TABLE public.prima_nota_lines ENABLE ROW LEVEL SECURITY;

-- Policy per visualizzazione (utenti autenticati possono vedere)
CREATE POLICY "prima_nota_lines_select_policy"
ON public.prima_nota_lines FOR SELECT
TO authenticated
USING (true);

-- Policy per inserimento (utenti autenticati possono inserire)
CREATE POLICY "prima_nota_lines_insert_policy"
ON public.prima_nota_lines FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy per aggiornamento
CREATE POLICY "prima_nota_lines_update_policy"
ON public.prima_nota_lines FOR UPDATE
TO authenticated
USING (true);

-- Policy per eliminazione
CREATE POLICY "prima_nota_lines_delete_policy"
ON public.prima_nota_lines FOR DELETE
TO authenticated
USING (true);

-- Commenti tabella
COMMENT ON TABLE public.prima_nota_lines IS 'Righe contabili in partita doppia per ogni movimento di Prima Nota';
COMMENT ON COLUMN public.prima_nota_lines.dare IS 'Importo in DARE (debito)';
COMMENT ON COLUMN public.prima_nota_lines.avere IS 'Importo in AVERE (credito)';
COMMENT ON COLUMN public.prima_nota_lines.dynamic_account_key IS 'Chiave per conti dinamici: BANCA, CASSA, CARTA, CREDITI_CLIENTI, DEBITI_FORNITORI, IVA_DEBITO, IVA_CREDITO';

-- Aggiungi commenti sui campi IVA
COMMENT ON COLUMN public.accounting_entries.iva_mode IS 'Regime IVA: DOMESTICA_IMPONIBILE, CESSIONE_UE_NON_IMPONIBILE, CESSIONE_EXTRA_UE_NON_IMPONIBILE, VENDITA_RC_EDILE, ACQUISTO_RC_EDILE';
COMMENT ON COLUMN public.accounting_entries.iva_aliquota IS 'Aliquota IVA in percentuale (es: 22, 10, 4)';
COMMENT ON COLUMN public.accounting_entries.imponibile IS 'Importo imponibile (senza IVA)';
COMMENT ON COLUMN public.accounting_entries.iva_amount IS 'Importo IVA';
COMMENT ON COLUMN public.accounting_entries.totale IS 'Totale documento (imponibile + IVA)';