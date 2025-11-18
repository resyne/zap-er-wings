-- Create junction table to link oven models with products and prices
CREATE TABLE IF NOT EXISTS public.oven_model_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oven_model_id UUID NOT NULL REFERENCES public.oven_models(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(oven_model_id, product_id)
);

-- Enable RLS
ALTER TABLE public.oven_model_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow authenticated users to view oven_model_products"
  ON public.oven_model_products
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert oven_model_products"
  ON public.oven_model_products
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update oven_model_products"
  ON public.oven_model_products
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to delete oven_model_products"
  ON public.oven_model_products
  FOR DELETE
  TO authenticated
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER set_oven_model_products_updated_at
  BEFORE UPDATE ON public.oven_model_products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();