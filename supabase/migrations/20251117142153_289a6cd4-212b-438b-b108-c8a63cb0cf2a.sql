-- Tabella per gestire media (foto/video) del configuratore prodotti
CREATE TABLE IF NOT EXISTS public.product_configurator_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  media_url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabella per configurazioni di prodotto (caratteristiche specifiche dei forni)
CREATE TABLE IF NOT EXISTS public.product_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  power_type TEXT, -- alimentazione (elettrico, gas, misto)
  size TEXT, -- dimensione
  installation_type TEXT CHECK (installation_type IN ('shipped', 'installed')), -- spedito o montato sul posto
  additional_info JSONB,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, model_name, power_type, size, installation_type)
);

-- Tabella per link pubblici univoci del configuratore
CREATE TABLE IF NOT EXISTS public.product_configurator_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unique_code TEXT NOT NULL UNIQUE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  configuration_id UUID REFERENCES public.product_configurations(id) ON DELETE SET NULL,
  title TEXT,
  description TEXT,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_product_configurator_media_product ON public.product_configurator_media(product_id);
CREATE INDEX IF NOT EXISTS idx_product_configurations_product ON public.product_configurations(product_id);
CREATE INDEX IF NOT EXISTS idx_product_configurator_links_code ON public.product_configurator_links(unique_code);
CREATE INDEX IF NOT EXISTS idx_product_configurator_links_lead ON public.product_configurator_links(lead_id);

-- Trigger per updated_at
CREATE TRIGGER update_product_configurator_media_updated_at
  BEFORE UPDATE ON public.product_configurator_media
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_configurations_updated_at
  BEFORE UPDATE ON public.product_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_configurator_links_updated_at
  BEFORE UPDATE ON public.product_configurator_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Funzione per generare codice univoco
CREATE OR REPLACE FUNCTION generate_configurator_code() RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
BEGIN
    LOOP
        new_code := upper(substr(md5(random()::text), 1, 10));
        SELECT EXISTS(SELECT 1 FROM public.product_configurator_links WHERE unique_code = new_code) INTO code_exists;
        IF NOT code_exists THEN
            RETURN new_code;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger per auto-generare il codice univoco
CREATE OR REPLACE FUNCTION auto_generate_configurator_code() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.unique_code IS NULL THEN
        NEW.unique_code := generate_configurator_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER auto_generate_configurator_code_trigger
  BEFORE INSERT ON public.product_configurator_links
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_configurator_code();

-- RLS Policies
ALTER TABLE public.product_configurator_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_configurator_links ENABLE ROW LEVEL SECURITY;

-- Policy per media: tutti possono leggere, solo autenticati possono gestire
CREATE POLICY "Allow public read access to configurator media"
  ON public.product_configurator_media FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage configurator media"
  ON public.product_configurator_media FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy per configurazioni: tutti possono leggere, solo autenticati possono gestire
CREATE POLICY "Allow public read access to product configurations"
  ON public.product_configurations FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to manage product configurations"
  ON public.product_configurations FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy per link: pubblico può leggere link attivi, autenticati possono gestire
CREATE POLICY "Allow public read access to active configurator links"
  ON public.product_configurator_links FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

CREATE POLICY "Allow authenticated users to manage configurator links"
  ON public.product_configurator_links FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);