-- Add stock tracking fields to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS current_stock numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minimum_stock numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS maximum_stock numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS production_cost numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sale_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS warehouse_location text DEFAULT null,
  ADD COLUMN IF NOT EXISTS last_inventory_date timestamp with time zone DEFAULT null;

-- Create product stock movements table
CREATE TABLE public.product_stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_date date NOT NULL DEFAULT CURRENT_DATE,
  movement_type text NOT NULL CHECK (movement_type IN ('carico', 'scarico')),
  origin_type text NOT NULL DEFAULT 'manuale',
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit text NOT NULL DEFAULT 'pz',
  notes text,
  status text NOT NULL DEFAULT 'confermato',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_stock_movements
CREATE POLICY "Authenticated users can view product movements"
  ON public.product_stock_movements FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert product movements"
  ON public.product_stock_movements FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update product movements"
  ON public.product_stock_movements FOR UPDATE
  TO authenticated USING (true);

-- Index for performance
CREATE INDEX idx_product_stock_movements_product_id ON public.product_stock_movements(product_id);
CREATE INDEX idx_product_stock_movements_created_at ON public.product_stock_movements(created_at DESC);