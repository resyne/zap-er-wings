-- Aggiunta campi per DDT secondo la nuova struttura
-- Campi per dipendente + sistema + amministrazione

ALTER TABLE public.ddts
ADD COLUMN IF NOT EXISTS direction text CHECK (direction IN ('IN', 'OUT')),
ADD COLUMN IF NOT EXISTS attachment_url text,
ADD COLUMN IF NOT EXISTS document_date date,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS work_order_id uuid REFERENCES public.work_orders(id),
ADD COLUMN IF NOT EXISTS uploaded_by uuid,
ADD COLUMN IF NOT EXISTS uploaded_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS status text DEFAULT 'da_verificare' CHECK (status IN ('da_verificare', 'verificato', 'fatturato', 'annullato')),
ADD COLUMN IF NOT EXISTS counterpart_type text CHECK (counterpart_type IN ('customer', 'supplier')),
ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id),
ADD COLUMN IF NOT EXISTS official_document_date date,
ADD COLUMN IF NOT EXISTS admin_status text DEFAULT 'da_fatturare' CHECK (admin_status IN ('da_fatturare', 'fatturato', 'non_fatturabile')),
ADD COLUMN IF NOT EXISTS invoiced boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS invoice_number text,
ADD COLUMN IF NOT EXISTS invoice_date date;

-- Commento per chiarezza sui campi
COMMENT ON COLUMN public.ddts.direction IS 'IN = merce ricevuta, OUT = merce consegnata';
COMMENT ON COLUMN public.ddts.attachment_url IS 'URL del documento allegato (foto o PDF) - OBBLIGATORIO';
COMMENT ON COLUMN public.ddts.document_date IS 'Data del fatto (consegna/ritiro)';
COMMENT ON COLUMN public.ddts.status IS 'Stato workflow: da_verificare, verificato, fatturato, annullato';
COMMENT ON COLUMN public.ddts.admin_status IS 'Stato amministrativo: da_fatturare, fatturato, non_fatturabile';