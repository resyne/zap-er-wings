-- Aggiungi colonna tags alla tabella crm_contacts per la segmentazione
ALTER TABLE public.crm_contacts 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Crea indice per migliorare le query sui tag
CREATE INDEX IF NOT EXISTS idx_crm_contacts_tags ON public.crm_contacts USING GIN(tags);