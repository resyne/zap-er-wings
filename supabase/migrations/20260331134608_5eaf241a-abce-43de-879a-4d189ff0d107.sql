ALTER TABLE public.scraping_results 
  ADD COLUMN IF NOT EXISTS response_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS response_type text,
  ADD COLUMN IF NOT EXISTS response_date timestamp with time zone,
  ADD COLUMN IF NOT EXISTS response_notes text;

COMMENT ON COLUMN public.scraping_results.response_status IS 'none, interested, not_interested, no_response';
COMMENT ON COLUMN public.scraping_results.response_type IS 'email_reply, phone_call, whatsapp, other';