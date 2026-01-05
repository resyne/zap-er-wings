
-- Add material_id to stock_movements to link movements to materials
ALTER TABLE public.stock_movements 
ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES public.materials(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_stock_movements_material_id ON public.stock_movements(material_id);
