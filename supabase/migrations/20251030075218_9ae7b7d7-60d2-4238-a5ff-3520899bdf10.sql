-- Create ddts table
CREATE TABLE public.ddts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ddt_number TEXT NOT NULL UNIQUE,
  shipping_order_id UUID REFERENCES public.shipping_orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id),
  pdf_data TEXT NOT NULL,
  ddt_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.ddts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view all DDTs"
ON public.ddts
FOR SELECT
USING (true);

CREATE POLICY "Users can create DDTs"
ON public.ddts
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Add index
CREATE INDEX idx_ddts_shipping_order ON public.ddts(shipping_order_id);
CREATE INDEX idx_ddts_customer ON public.ddts(customer_id);
CREATE INDEX idx_ddts_number ON public.ddts(ddt_number);
