CREATE TABLE public.scraping_email_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scraping_email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to scraping_email_settings" ON public.scraping_email_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Insert default values
INSERT INTO public.scraping_email_settings (setting_key, setting_value) VALUES
  ('sender_email', 'noreply@erp.abbattitorizapper.it'),
  ('sender_name', 'ZAPPER Team'),
  ('reply_to', 'info@abbattitorizapper.it'),
  ('html_template', '')
ON CONFLICT (setting_key) DO NOTHING;