-- Tabella mappatura interni telefonici → utenti
CREATE TABLE public.phone_extensions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  extension_number VARCHAR(20) NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id),
  operator_name VARCHAR(255) NOT NULL,
  operator_email VARCHAR(255),
  department VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indice per ricerca rapida
CREATE INDEX idx_phone_extensions_number ON public.phone_extensions(extension_number);

-- Enable RLS
ALTER TABLE public.phone_extensions ENABLE ROW LEVEL SECURITY;

-- Policy per lettura (tutti gli utenti autenticati)
CREATE POLICY "Authenticated users can view phone extensions"
ON public.phone_extensions FOR SELECT
TO authenticated
USING (true);

-- Policy per gestione (solo admin/manager)
CREATE POLICY "Admins can manage phone extensions"
ON public.phone_extensions FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Aggiungere colonne a call_records per collegamento lead e analisi AI
ALTER TABLE public.call_records 
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id),
ADD COLUMN IF NOT EXISTS extension_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS operator_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS operator_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS transcription TEXT,
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS ai_sentiment VARCHAR(50),
ADD COLUMN IF NOT EXISTS ai_actions JSONB,
ADD COLUMN IF NOT EXISTS ai_processed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS direction VARCHAR(20) DEFAULT 'inbound',
ADD COLUMN IF NOT EXISTS matched_by VARCHAR(50);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_call_records_lead_id ON public.call_records(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_records_operator_id ON public.call_records(operator_id);
CREATE INDEX IF NOT EXISTS idx_call_records_caller_number ON public.call_records(caller_number);
CREATE INDEX IF NOT EXISTS idx_call_records_called_number ON public.call_records(called_number);

-- Trigger per aggiornamento timestamp
CREATE TRIGGER update_phone_extensions_updated_at
BEFORE UPDATE ON public.phone_extensions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();