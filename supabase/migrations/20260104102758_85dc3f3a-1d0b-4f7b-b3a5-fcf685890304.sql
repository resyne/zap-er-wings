-- Create table for DDT line items
CREATE TABLE public.ddt_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ddt_id UUID NOT NULL REFERENCES public.ddts(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'pz',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ddt_items ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view ddt items" ON public.ddt_items
FOR SELECT USING (true);

CREATE POLICY "Users can insert ddt items" ON public.ddt_items
FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update ddt items" ON public.ddt_items
FOR UPDATE USING (true);

CREATE POLICY "Users can delete ddt items" ON public.ddt_items
FOR DELETE USING (true);

-- Index for performance
CREATE INDEX idx_ddt_items_ddt_id ON public.ddt_items(ddt_id);