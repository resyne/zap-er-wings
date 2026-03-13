
-- Expand metodo_pagamento constraint on movimenti_finanziari
ALTER TABLE public.movimenti_finanziari DROP CONSTRAINT IF EXISTS movimenti_finanziari_metodo_pagamento_check;
ALTER TABLE public.movimenti_finanziari ADD CONSTRAINT movimenti_finanziari_metodo_pagamento_check 
  CHECK (metodo_pagamento IN ('banca', 'cassa', 'carta', 'carta_aziendale', 'anticipo_dipendente', 'contanti', 'carta_q8', 'american_express', 'banca_intesa'));

-- Expand payment_method constraint on accounting_entries
ALTER TABLE public.accounting_entries DROP CONSTRAINT IF EXISTS accounting_entries_payment_method_check;
ALTER TABLE public.accounting_entries ADD CONSTRAINT accounting_entries_payment_method_check 
  CHECK (payment_method IN ('contanti', 'carta', 'bonifico', 'anticipo_personale', 'non_so', 'american_express', 'banca', 'cassa', 'carta_aziendale', 'anticipo_dipendente', 'carta_q8', 'banca_intesa'));

-- Add stato_rimborso column to movimenti_finanziari for tracking reimbursements
ALTER TABLE public.movimenti_finanziari ADD COLUMN IF NOT EXISTS stato_rimborso TEXT DEFAULT NULL CHECK (stato_rimborso IN ('da_rimborsare', 'rimborsato'));
