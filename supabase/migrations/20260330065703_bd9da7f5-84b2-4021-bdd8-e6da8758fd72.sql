ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS warehouse_category_id uuid REFERENCES public.warehouse_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS warehouse_subcategory_id uuid REFERENCES public.warehouse_subcategories(id) ON DELETE SET NULL;