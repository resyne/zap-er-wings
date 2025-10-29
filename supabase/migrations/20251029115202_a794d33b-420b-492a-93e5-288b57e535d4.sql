-- Add offer_id column to sales_orders table
ALTER TABLE public.sales_orders 
ADD COLUMN IF NOT EXISTS offer_id UUID REFERENCES public.offers(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_sales_orders_offer_id ON public.sales_orders(offer_id);