-- Aggiungi colonna pre_qualificato alla tabella leads
ALTER TABLE public.leads 
ADD COLUMN pre_qualificato boolean DEFAULT false;

-- Imposta pre_qualificato = true per tutti i lead creati automaticamente da chiamate
UPDATE public.leads 
SET pre_qualificato = true 
WHERE source = 'phone_call' 
AND company_name = 'Da identificare';

-- Commento per chiarezza
COMMENT ON COLUMN public.leads.pre_qualificato IS 'Lead contattato telefonicamente senza lead preesistente';