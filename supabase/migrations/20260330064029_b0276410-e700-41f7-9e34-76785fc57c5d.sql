-- Product categories
CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage product_categories"
  ON public.product_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Product subcategories
CREATE TABLE public.product_subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage product_subcategories"
  ON public.product_subcategories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add category reference to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_subcategory_id uuid REFERENCES public.product_subcategories(id) ON DELETE SET NULL;