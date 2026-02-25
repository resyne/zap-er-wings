
-- Tabella log inventari
CREATE TABLE public.inventory_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,
  material_id UUID REFERENCES public.materials(id) ON DELETE CASCADE,
  material_code TEXT,
  material_name TEXT,
  old_quantity NUMERIC NOT NULL DEFAULT 0,
  new_quantity NUMERIC NOT NULL DEFAULT 0,
  difference NUMERIC NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'pcs',
  supplier_name TEXT,
  notes TEXT
);

-- RLS
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view inventory logs"
  ON public.inventory_logs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert inventory logs"
  ON public.inventory_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
