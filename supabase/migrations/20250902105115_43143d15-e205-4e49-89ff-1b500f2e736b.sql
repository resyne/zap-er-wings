-- Create shipping orders table
CREATE TABLE public.shipping_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT NOT NULL,
  customer_id UUID REFERENCES public.companies(id),
  status TEXT NOT NULL DEFAULT 'da_preparare',
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  preparation_date TIMESTAMP WITH TIME ZONE,
  ready_date TIMESTAMP WITH TIME ZONE,
  shipped_date TIMESTAMP WITH TIME ZONE,
  delivered_date TIMESTAMP WITH TIME ZONE,
  payment_on_delivery BOOLEAN DEFAULT false,
  payment_amount NUMERIC,
  notes TEXT,
  shipping_address TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create shipping order items table
CREATE TABLE public.shipping_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_order_id UUID NOT NULL REFERENCES public.shipping_orders(id) ON DELETE CASCADE,
  material_id UUID REFERENCES public.materials(id),
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC DEFAULT 0,
  total_price NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sequence for shipping order numbers
CREATE SEQUENCE IF NOT EXISTS shipping_order_sequence START 1;

-- Create function to generate shipping order numbers
CREATE OR REPLACE FUNCTION public.generate_shipping_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN 'OdS-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('shipping_order_sequence')::TEXT, 4, '0');
END;
$$;

-- Create trigger to auto-generate shipping order numbers
CREATE OR REPLACE FUNCTION public.auto_generate_shipping_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.number IS NULL OR NEW.number = '' THEN
        NEW.number := generate_shipping_order_number();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER shipping_order_number_trigger
  BEFORE INSERT ON public.shipping_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_shipping_order_number();

-- Create trigger to update timestamps
CREATE TRIGGER update_shipping_orders_updated_at
  BEFORE UPDATE ON public.shipping_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shipping_order_items_updated_at
  BEFORE UPDATE ON public.shipping_order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.shipping_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_order_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for shipping_orders
CREATE POLICY "Users can view shipping orders" ON public.shipping_orders
  FOR SELECT USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can create shipping orders" ON public.shipping_orders
  FOR INSERT WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Moderators can manage shipping orders" ON public.shipping_orders
  FOR ALL USING (has_minimum_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Service role full access shipping orders" ON public.shipping_orders
  FOR ALL USING (true) WITH CHECK (true);

-- Create RLS policies for shipping_order_items
CREATE POLICY "Users can view shipping order items" ON public.shipping_order_items
  FOR SELECT USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can create shipping order items" ON public.shipping_order_items
  FOR INSERT WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Moderators can manage shipping order items" ON public.shipping_order_items
  FOR ALL USING (has_minimum_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Service role full access shipping order items" ON public.shipping_order_items
  FOR ALL USING (true) WITH CHECK (true);