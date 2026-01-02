-- Aggiungi la colonna chart_account_id come foreign key al Piano dei Conti
ALTER TABLE public.accounting_entries 
ADD COLUMN chart_account_id UUID REFERENCES public.chart_of_accounts(id);

-- Crea un indice per migliorare le performance delle query
CREATE INDEX idx_accounting_entries_chart_account_id ON public.accounting_entries(chart_account_id);

-- Commento per documentazione
COMMENT ON COLUMN public.accounting_entries.chart_account_id IS 'Riferimento al Piano dei Conti - classifica la NATURA economica dell''evento';