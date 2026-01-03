-- Tabella Movimenti Finanziari
CREATE TABLE public.movimenti_finanziari (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    data_movimento DATE NOT NULL,
    importo NUMERIC(15,2) NOT NULL,
    direzione VARCHAR(10) NOT NULL CHECK (direzione IN ('entrata', 'uscita')),
    metodo_pagamento VARCHAR(20) NOT NULL CHECK (metodo_pagamento IN ('banca', 'cassa', 'carta')),
    
    -- Soggetto (opzionale)
    soggetto_tipo VARCHAR(20) CHECK (soggetto_tipo IN ('cliente', 'fornitore', 'dipendente')),
    soggetto_id UUID,
    soggetto_nome TEXT,
    
    -- Documento allegato
    allegato_url TEXT,
    allegato_nome TEXT,
    
    -- Riferimento testo libero
    riferimento TEXT,
    descrizione TEXT,
    
    -- Collegamento opzionale
    tipo_allocazione VARCHAR(30) CHECK (tipo_allocazione IN (
        'incasso_fattura',
        'pagamento_fattura', 
        'anticipo_cliente',
        'anticipo_fornitore',
        'rimborso_dipendente',
        'spesa_cassa',
        'giroconto',
        'altro'
    )),
    
    -- Riferimenti a scadenze/fatture
    scadenza_id UUID REFERENCES public.scadenze(id),
    fattura_id UUID REFERENCES public.invoice_registry(id),
    
    -- Centro di costo/ricavo
    centro_costo_id UUID REFERENCES public.cost_centers(id),
    centro_ricavo_id UUID REFERENCES public.profit_centers(id),
    
    -- Conto contabile
    conto_id UUID REFERENCES public.chart_of_accounts(id),
    
    -- Prima nota collegata
    prima_nota_id UUID REFERENCES public.prima_nota(id),
    
    -- Stati
    stato VARCHAR(20) NOT NULL DEFAULT 'grezzo' CHECK (stato IN (
        'grezzo',
        'da_verificare',
        'da_classificare',
        'allocato',
        'contabilizzato'
    )),
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    classificato_da UUID REFERENCES auth.users(id),
    classificato_at TIMESTAMPTZ,
    note_cfo TEXT
);

-- Indici
CREATE INDEX idx_movimenti_finanziari_data ON public.movimenti_finanziari(data_movimento);
CREATE INDEX idx_movimenti_finanziari_stato ON public.movimenti_finanziari(stato);
CREATE INDEX idx_movimenti_finanziari_direzione ON public.movimenti_finanziari(direzione);
CREATE INDEX idx_movimenti_finanziari_soggetto ON public.movimenti_finanziari(soggetto_tipo, soggetto_id);

-- RLS
ALTER TABLE public.movimenti_finanziari ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view movimenti_finanziari"
ON public.movimenti_finanziari FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert movimenti_finanziari"
ON public.movimenti_finanziari FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update movimenti_finanziari"
ON public.movimenti_finanziari FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete movimenti_finanziari"
ON public.movimenti_finanziari FOR DELETE
TO authenticated
USING (true);

-- Trigger per updated_at
CREATE TRIGGER set_movimenti_finanziari_updated_at
    BEFORE UPDATE ON public.movimenti_finanziari
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();