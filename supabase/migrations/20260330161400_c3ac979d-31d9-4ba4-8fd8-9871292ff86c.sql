
-- Scraping missions table
CREATE TABLE public.scraping_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  mission_description TEXT NOT NULL,
  sender_name TEXT,
  sender_company TEXT,
  email_language TEXT DEFAULT 'Italiano',
  country_code TEXT DEFAULT 'it',
  language_code TEXT DEFAULT 'it',
  max_results_per_city INTEGER DEFAULT 20,
  status TEXT NOT NULL DEFAULT 'pending',
  total_cities INTEGER DEFAULT 0,
  completed_cities INTEGER DEFAULT 0,
  total_results INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scraping results table
CREATE TABLE public.scraping_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES public.scraping_missions(id) ON DELETE CASCADE NOT NULL,
  city TEXT NOT NULL,
  title TEXT,
  url TEXT,
  description TEXT,
  position INTEGER,
  generated_email_subject TEXT,
  generated_email_body TEXT,
  recipient_name TEXT,
  recipient_company TEXT,
  email_generated BOOLEAN DEFAULT false,
  email_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_scraping_results_mission ON public.scraping_results(mission_id);
CREATE INDEX idx_scraping_missions_status ON public.scraping_missions(status);

-- RLS
ALTER TABLE public.scraping_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraping_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage scraping_missions" ON public.scraping_missions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can manage scraping_results" ON public.scraping_results
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Updated at trigger
CREATE TRIGGER set_scraping_missions_updated_at
  BEFORE UPDATE ON public.scraping_missions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
