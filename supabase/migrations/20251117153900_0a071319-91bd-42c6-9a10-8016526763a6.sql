-- Tabella per gestire i link univoci del configuratore
CREATE TABLE IF NOT EXISTS configurator_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  preselected_model TEXT,
  preselected_power TEXT,
  preselected_size INTEGER,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS policies
ALTER TABLE configurator_links ENABLE ROW LEVEL SECURITY;

-- Policy per permettere a tutti di leggere link attivi
CREATE POLICY "Public can view active configurator links"
  ON configurator_links
  FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Policy per utenti autenticati di gestire i link
CREATE POLICY "Authenticated users can manage configurator links"
  ON configurator_links
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Service role full access
CREATE POLICY "Service role full access configurator links"
  ON configurator_links
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Indice per ricerca rapida per codice
CREATE INDEX idx_configurator_links_code ON configurator_links(code);

-- Indice per link attivi
CREATE INDEX idx_configurator_links_active ON configurator_links(is_active, expires_at);