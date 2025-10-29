-- Add product_name column to shipping_order_items to track items without material_id
ALTER TABLE public.shipping_order_items
ADD COLUMN IF NOT EXISTS product_name TEXT;

-- Add index for product_name
CREATE INDEX IF NOT EXISTS idx_shipping_order_items_product_name 
ON public.shipping_order_items(product_name);