-- Create junction table for BOM-Product many-to-many relationship
CREATE TABLE public.bom_products (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    bom_id UUID NOT NULL REFERENCES public.boms(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(bom_id, product_id)
);

-- Enable RLS
ALTER TABLE public.bom_products ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all authenticated users to read bom_products"
ON public.bom_products FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow all authenticated users to insert bom_products"
ON public.bom_products FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow all authenticated users to delete bom_products"
ON public.bom_products FOR DELETE TO authenticated USING (true);

-- Migrate existing product_id data to new junction table
INSERT INTO public.bom_products (bom_id, product_id)
SELECT id, product_id FROM public.boms WHERE product_id IS NOT NULL;

-- Create index for performance
CREATE INDEX idx_bom_products_bom_id ON public.bom_products(bom_id);
CREATE INDEX idx_bom_products_product_id ON public.bom_products(product_id);