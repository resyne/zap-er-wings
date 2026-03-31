ALTER TABLE public.scraping_missions 
  ADD COLUMN IF NOT EXISTS email_generation_status text DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS email_generation_processed integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_generation_total integer DEFAULT 0;