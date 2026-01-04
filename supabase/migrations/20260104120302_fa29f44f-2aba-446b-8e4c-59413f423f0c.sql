-- Create stock_movements table for warehouse movements
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Identificazione
  movement_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('carico', 'scarico')),
  origin_type TEXT NOT NULL DEFAULT 'DDT' CHECK (origin_type IN ('DDT', 'manuale', 'inventario', 'produzione')),
  ddt_id UUID REFERENCES public.ddts(id) ON DELETE SET NULL,
  
  -- Articolo
  item_description TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT DEFAULT 'pz',
  
  -- Deposito
  warehouse TEXT DEFAULT 'sede-principale',
  
  -- Stato movimento
  status TEXT NOT NULL DEFAULT 'proposto' CHECK (status IN ('proposto', 'confermato', 'annullato')),
  
  -- Collegamenti (derivati dal DDT)
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Note
  notes TEXT
);

-- Enable Row Level Security
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view stock movements" 
ON public.stock_movements 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create stock movements" 
ON public.stock_movements 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update stock movements" 
ON public.stock_movements 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete stock movements" 
ON public.stock_movements 
FOR DELETE 
TO authenticated
USING (true);

-- Create indexes for better performance
CREATE INDEX idx_stock_movements_ddt_id ON public.stock_movements(ddt_id);
CREATE INDEX idx_stock_movements_movement_date ON public.stock_movements(movement_date DESC);
CREATE INDEX idx_stock_movements_status ON public.stock_movements(status);
CREATE INDEX idx_stock_movements_movement_type ON public.stock_movements(movement_type);