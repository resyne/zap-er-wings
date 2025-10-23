-- Create products table for product catalog
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  product_type TEXT NOT NULL CHECK (product_type IN ('machinery', 'component', 'spare_part', 'service')),
  material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL,
  bom_id UUID REFERENCES public.boms(id) ON DELETE SET NULL,
  base_price NUMERIC(10,2),
  unit_of_measure TEXT DEFAULT 'pz',
  is_active BOOLEAN DEFAULT true,
  image_url TEXT,
  technical_specs JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create price_lists table
CREATE TABLE public.price_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  list_type TEXT NOT NULL CHECK (list_type IN ('country', 'region', 'customer_category', 'reseller', 'custom')),
  country TEXT,
  region TEXT,
  customer_category TEXT,
  is_active BOOLEAN DEFAULT true,
  valid_from DATE,
  valid_to DATE,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create price_list_items table
CREATE TABLE public.price_list_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  price_list_id UUID NOT NULL REFERENCES public.price_lists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price NUMERIC(10,2) NOT NULL,
  discount_percentage NUMERIC(5,2) DEFAULT 0,
  minimum_quantity INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(price_list_id, product_id)
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_list_items ENABLE ROW LEVEL SECURITY;

-- Create policies for products
CREATE POLICY "Users can view products"
  ON public.products FOR SELECT
  USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Moderators can manage products"
  ON public.products FOR ALL
  USING (has_minimum_role(auth.uid(), 'moderator'::app_role))
  WITH CHECK (has_minimum_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Service role full access products"
  ON public.products FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create policies for price_lists
CREATE POLICY "Users can view price lists"
  ON public.price_lists FOR SELECT
  USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Moderators can manage price lists"
  ON public.price_lists FOR ALL
  USING (has_minimum_role(auth.uid(), 'moderator'::app_role))
  WITH CHECK (has_minimum_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Service role full access price lists"
  ON public.price_lists FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create policies for price_list_items
CREATE POLICY "Users can view price list items"
  ON public.price_list_items FOR SELECT
  USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Moderators can manage price list items"
  ON public.price_list_items FOR ALL
  USING (has_minimum_role(auth.uid(), 'moderator'::app_role))
  WITH CHECK (has_minimum_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Service role full access price list items"
  ON public.price_list_items FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_products_code ON public.products(code);
CREATE INDEX idx_products_type ON public.products(product_type);
CREATE INDEX idx_products_active ON public.products(is_active);
CREATE INDEX idx_price_lists_active ON public.price_lists(is_active);
CREATE INDEX idx_price_list_items_product ON public.price_list_items(product_id);
CREATE INDEX idx_price_list_items_list ON public.price_list_items(price_list_id);

-- Create trigger for updated_at
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_price_lists_updated_at
  BEFORE UPDATE ON public.price_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_price_list_items_updated_at
  BEFORE UPDATE ON public.price_list_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();