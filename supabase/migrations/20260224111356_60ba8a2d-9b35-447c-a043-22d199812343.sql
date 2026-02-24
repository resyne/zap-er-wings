
-- Competitors table
CREATE TABLE public.competitors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  website TEXT,
  country TEXT,
  notes TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view competitors"
  ON public.competitors FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert competitors"
  ON public.competitors FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update competitors"
  ON public.competitors FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete competitors"
  ON public.competitors FOR DELETE
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER set_competitors_updated_at
  BEFORE UPDATE ON public.competitors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Competitor price lists (uploaded documents)
CREATE TABLE public.competitor_price_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competitor_id UUID NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  notes TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.competitor_price_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view competitor price lists"
  ON public.competitor_price_lists FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert competitor price lists"
  ON public.competitor_price_lists FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete competitor price lists"
  ON public.competitor_price_lists FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Competitor products (extracted from price lists or manual)
CREATE TABLE public.competitor_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competitor_id UUID NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  price_list_id UUID REFERENCES public.competitor_price_lists(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  model TEXT,
  category TEXT,
  price NUMERIC,
  currency TEXT DEFAULT 'EUR',
  specifications JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.competitor_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view competitor products"
  ON public.competitor_products FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert competitor products"
  ON public.competitor_products FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update competitor products"
  ON public.competitor_products FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete competitor products"
  ON public.competitor_products FOR DELETE
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER set_competitor_products_updated_at
  BEFORE UPDATE ON public.competitor_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
