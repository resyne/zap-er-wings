-- Add classification fields to accounting_entries table
ALTER TABLE public.accounting_entries
ADD COLUMN IF NOT EXISTS event_type text,
ADD COLUMN IF NOT EXISTS affects_income_statement boolean DEFAULT NULL,
ADD COLUMN IF NOT EXISTS account_code text,
ADD COLUMN IF NOT EXISTS temporal_competence text DEFAULT 'immediata',
ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_period text,
ADD COLUMN IF NOT EXISTS recurrence_start_date date,
ADD COLUMN IF NOT EXISTS recurrence_end_date date,
ADD COLUMN IF NOT EXISTS cost_center_id uuid REFERENCES public.cost_centers(id),
ADD COLUMN IF NOT EXISTS profit_center_id uuid REFERENCES public.profit_centers(id),
ADD COLUMN IF NOT EXISTS center_percentage numeric DEFAULT 100,
ADD COLUMN IF NOT EXISTS economic_subject_type text,
ADD COLUMN IF NOT EXISTS economic_subject_id uuid,
ADD COLUMN IF NOT EXISTS financial_status text,
ADD COLUMN IF NOT EXISTS payment_date date,
ADD COLUMN IF NOT EXISTS cfo_notes text,
ADD COLUMN IF NOT EXISTS classified_by uuid,
ADD COLUMN IF NOT EXISTS classified_at timestamp with time zone;

-- Add comments for documentation
COMMENT ON COLUMN public.accounting_entries.event_type IS 'ricavo, costo, evento_finanziario, assestamento, evento_interno';
COMMENT ON COLUMN public.accounting_entries.affects_income_statement IS 'Whether this event affects the income statement';
COMMENT ON COLUMN public.accounting_entries.account_code IS 'Reference to chart of accounts';
COMMENT ON COLUMN public.accounting_entries.temporal_competence IS 'immediata, differita, rateizzata';
COMMENT ON COLUMN public.accounting_entries.financial_status IS 'pagato, da_pagare, incassato, da_incassare, anticipato_dipendente';
COMMENT ON COLUMN public.accounting_entries.economic_subject_type IS 'cliente, fornitore, dipendente, progetto';