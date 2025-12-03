-- Add product_id column to boms table to link Level 0 models to products
ALTER TABLE public.boms 
ADD COLUMN product_id UUID REFERENCES public.products(id);

-- Add an index for better query performance
CREATE INDEX idx_boms_product_id ON public.boms(product_id);

-- Comment for documentation
COMMENT ON COLUMN public.boms.product_id IS 'Links Level 0 BOM models to the products catalog';