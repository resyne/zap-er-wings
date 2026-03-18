
-- Table to track processed invoice emails to avoid duplicates
CREATE TABLE public.invoice_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_message_id TEXT NOT NULL,
  email_subject TEXT,
  email_from TEXT,
  email_date TIMESTAMPTZ,
  attachment_filename TEXT,
  attachment_url TEXT,
  invoice_registry_id UUID REFERENCES public.invoice_registry(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processed, failed, skipped
  error_message TEXT,
  ai_raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for deduplication
CREATE UNIQUE INDEX idx_invoice_email_unique ON public.invoice_email_log(email_message_id, attachment_filename);
CREATE INDEX idx_invoice_email_status ON public.invoice_email_log(status);

-- RLS
ALTER TABLE public.invoice_email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view invoice email logs" ON public.invoice_email_log FOR SELECT TO authenticated USING (true);
