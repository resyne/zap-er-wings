-- Add product_id column to offer_items to link with product catalog
ALTER TABLE public.offer_items 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

-- Create index for better performance if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_offer_items_product_id') THEN
    CREATE INDEX idx_offer_items_product_id ON public.offer_items(product_id);
  END IF;
END $$;