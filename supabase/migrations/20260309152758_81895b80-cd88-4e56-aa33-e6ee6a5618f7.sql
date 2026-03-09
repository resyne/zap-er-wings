
-- Create attachment type enum
CREATE TYPE public.document_attachment_type AS ENUM (
  'scontrino',
  'rapporto_intervento',
  'ddt',
  'preventivo',
  'foto_lavori',
  'ordine',
  'contratto',
  'altro'
);

-- Create document_attachments table
CREATE TABLE public.document_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.accounting_documents(id) ON DELETE CASCADE,
  attachment_type document_attachment_type NOT NULL DEFAULT 'altro',
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  notes TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX idx_document_attachments_document_id ON public.document_attachments(document_id);

-- Enable RLS
ALTER TABLE public.document_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view attachments"
  ON public.document_attachments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert attachments"
  ON public.document_attachments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can delete own attachments"
  ON public.document_attachments FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid());

-- Storage bucket for document attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('document-attachments', 'document-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Auth users can upload document attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'document-attachments');

CREATE POLICY "Auth users can view document attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'document-attachments');

CREATE POLICY "Auth users can delete own document attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'document-attachments');
