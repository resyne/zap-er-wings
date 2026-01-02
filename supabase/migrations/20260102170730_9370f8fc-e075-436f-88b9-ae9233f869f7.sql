-- Create table for entry/exit register
CREATE TABLE public.accounting_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  direction TEXT NOT NULL CHECK (direction IN ('entrata', 'uscita')),
  document_type TEXT NOT NULL CHECK (document_type IN ('fattura', 'scontrino', 'estratto_conto', 'documento_interno', 'rapporto_intervento', 'altro')),
  amount NUMERIC(12,2) NOT NULL,
  document_date DATE NOT NULL,
  attachment_url TEXT NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('contanti', 'carta', 'bonifico', 'anticipo_personale', 'non_so')),
  subject_type TEXT CHECK (subject_type IN ('cliente', 'fornitore', 'interno')),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'da_classificare' CHECK (status IN ('da_classificare', 'classificato', 'registrato')),
  ai_extracted_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view all entries
CREATE POLICY "Authenticated users can view all entries"
ON public.accounting_entries
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Policy: All authenticated users can create entries
CREATE POLICY "Authenticated users can create entries"
ON public.accounting_entries
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Users can update entries
CREATE POLICY "Authenticated users can update entries"
ON public.accounting_entries
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Policy: Users can delete their own entries
CREATE POLICY "Users can delete their own entries"
ON public.accounting_entries
FOR DELETE
USING (auth.uid() = user_id);

-- Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('accounting-attachments', 'accounting-attachments', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload accounting attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'accounting-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view accounting attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'accounting-attachments');

CREATE POLICY "Users can delete their own accounting attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'accounting-attachments' AND auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_accounting_entries_updated_at
BEFORE UPDATE ON public.accounting_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();