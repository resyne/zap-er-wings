-- Create sales_order_items table to store order products
CREATE TABLE IF NOT EXISTS public.sales_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC DEFAULT 0,
  vat_rate NUMERIC DEFAULT 22,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on sales_order_id for faster queries
CREATE INDEX IF NOT EXISTS idx_sales_order_items_sales_order_id 
ON public.sales_order_items(sales_order_id);

-- Enable RLS
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;

-- Create policies for sales_order_items
CREATE POLICY "Users can view sales order items"
  ON public.sales_order_items
  FOR SELECT
  USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Moderators can manage sales order items"
  ON public.sales_order_items
  FOR ALL
  USING (has_minimum_role(auth.uid(), 'moderator'::app_role))
  WITH CHECK (has_minimum_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Service role full access sales order items"
  ON public.sales_order_items
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_sales_order_items_updated_at
  BEFORE UPDATE ON public.sales_order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();