ALTER TABLE public.management_commesse 
  ADD COLUMN IF NOT EXISTS data_competenza date,
  ADD COLUMN IF NOT EXISTS data_fattura date,
  ADD COLUMN IF NOT EXISTS numero_fattura text;

CREATE INDEX IF NOT EXISTS idx_management_commesse_data_competenza 
  ON public.management_commesse(data_competenza);
CREATE INDEX IF NOT EXISTS idx_management_commesse_data_fattura 
  ON public.management_commesse(data_fattura);