-- Drop the existing check constraint
ALTER TABLE public.accounting_entries DROP CONSTRAINT IF EXISTS accounting_entries_status_check;

-- Add new check constraint with all required status values
ALTER TABLE public.accounting_entries ADD CONSTRAINT accounting_entries_status_check 
CHECK (status = ANY (ARRAY['da_classificare', 'classificato', 'registrato', 'pronto_prima_nota', 'sospeso', 'richiesta_integrazione']));