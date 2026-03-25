-- Add assegno to accounting_entries payment_method constraint
ALTER TABLE public.accounting_entries DROP CONSTRAINT IF EXISTS accounting_entries_payment_method_check;
ALTER TABLE public.accounting_entries ADD CONSTRAINT accounting_entries_payment_method_check 
  CHECK (payment_method IN ('contanti', 'carta', 'bonifico', 'anticipo_personale', 'non_so', 'american_express', 'banca', 'cassa', 'carta_aziendale', 'anticipo_dipendente', 'carta_q8', 'banca_intesa', 'assegno'));

-- Add check_due_date and check_number columns to scadenza_movimenti for tracking checks
ALTER TABLE public.scadenza_movimenti ADD COLUMN IF NOT EXISTS check_due_date DATE;
ALTER TABLE public.scadenza_movimenti ADD COLUMN IF NOT EXISTS check_number TEXT;