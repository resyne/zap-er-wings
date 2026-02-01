-- Create table for step translations by language
CREATE TABLE public.lead_automation_step_translations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  step_id UUID NOT NULL REFERENCES public.lead_automation_steps(id) ON DELETE CASCADE,
  language_code VARCHAR(5) NOT NULL, -- 'it', 'en', 'es', 'fr', 'de'
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(step_id, language_code)
);

-- Enable RLS
ALTER TABLE public.lead_automation_step_translations ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view translations" 
ON public.lead_automation_step_translations 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create translations" 
ON public.lead_automation_step_translations 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update translations" 
ON public.lead_automation_step_translations 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete translations" 
ON public.lead_automation_step_translations 
FOR DELETE 
TO authenticated
USING (true);

-- Add index for fast lookup
CREATE INDEX idx_step_translations_step_language ON public.lead_automation_step_translations(step_id, language_code);

-- Add comment explaining the language codes
COMMENT ON TABLE public.lead_automation_step_translations IS 'Stores translations for automation email steps. Default step content is used as fallback (English). Language codes: it=Italia, en=English, es=Spagna, fr=Francia, de=Germania';

-- Create mapping table for country to language
CREATE TABLE public.country_language_mapping (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_name VARCHAR(100) NOT NULL UNIQUE,
  language_code VARCHAR(5) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default mappings
INSERT INTO public.country_language_mapping (country_name, language_code) VALUES
  ('Italia', 'it'),
  ('Italy', 'it'),
  ('Spagna', 'es'),
  ('Spain', 'es'),
  ('Francia', 'fr'),
  ('France', 'fr'),
  ('Inghilterra', 'en'),
  ('UK', 'en'),
  ('United Kingdom', 'en'),
  ('England', 'en'),
  ('Germania', 'de'),
  ('Germany', 'de'),
  ('Portogallo', 'pt'),
  ('Portugal', 'pt'),
  ('USA', 'en'),
  ('United States', 'en'),
  ('Stati Uniti', 'en');

-- Enable RLS
ALTER TABLE public.country_language_mapping ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Anyone can read country mappings" 
ON public.country_language_mapping 
FOR SELECT 
TO authenticated
USING (true);