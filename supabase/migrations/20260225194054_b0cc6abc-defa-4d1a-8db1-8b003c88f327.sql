
-- Add product capability fields to products table
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS requires_production boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS installation_possible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shipping_possible boolean NOT NULL DEFAULT true;

-- Add order_type_category to sales_orders for the new order type classification
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS order_type_category text,
  ADD COLUMN IF NOT EXISTS delivery_mode text,
  ADD COLUMN IF NOT EXISTS is_warranty boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS order_subject text;

COMMENT ON COLUMN public.products.requires_production IS 'Whether this product requires production';
COMMENT ON COLUMN public.products.installation_possible IS 'Whether installation at customer site is possible';
COMMENT ON COLUMN public.products.shipping_possible IS 'Whether this product can be shipped';
COMMENT ON COLUMN public.sales_orders.order_type_category IS 'Order category: produzione, intervento, ricambi, installazione, misto';
COMMENT ON COLUMN public.sales_orders.delivery_mode IS 'Delivery mode: installazione, spedizione, ritiro';
COMMENT ON COLUMN public.sales_orders.is_warranty IS 'Whether this is a warranty order';
COMMENT ON COLUMN public.sales_orders.order_subject IS 'Free text subject/description of the order';
