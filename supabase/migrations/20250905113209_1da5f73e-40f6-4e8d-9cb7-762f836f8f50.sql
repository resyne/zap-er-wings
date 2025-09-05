-- Create customer cost drafts table
CREATE TABLE public.customer_cost_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES companies(id),
  draft_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  description TEXT,
  total_cost NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected')),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create cost draft items table
CREATE TABLE public.cost_draft_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID NOT NULL REFERENCES customer_cost_drafts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('material', 'technician', 'custom_material')),
  material_id UUID REFERENCES materials(id),
  technician_id UUID REFERENCES technicians(id),
  name TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_cost NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  unit TEXT,
  hours NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_cost_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_draft_items ENABLE ROW LEVEL SECURITY;

-- Policies for customer_cost_drafts
CREATE POLICY "Users can view cost drafts" ON public.customer_cost_drafts
  FOR SELECT USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can create cost drafts" ON public.customer_cost_drafts
  FOR INSERT WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Moderators can manage cost drafts" ON public.customer_cost_drafts
  FOR ALL USING (has_minimum_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Service role full access cost drafts" ON public.customer_cost_drafts
  FOR ALL USING (true) WITH CHECK (true);

-- Policies for cost_draft_items
CREATE POLICY "Users can view cost draft items" ON public.cost_draft_items
  FOR SELECT USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can create cost draft items" ON public.cost_draft_items
  FOR INSERT WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Moderators can manage cost draft items" ON public.cost_draft_items
  FOR ALL USING (has_minimum_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Service role full access cost draft items" ON public.cost_draft_items
  FOR ALL USING (true) WITH CHECK (true);

-- Add triggers for updated_at
CREATE TRIGGER update_customer_cost_drafts_updated_at
  BEFORE UPDATE ON public.customer_cost_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cost_draft_items_updated_at
  BEFORE UPDATE ON public.cost_draft_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create sequence for draft numbers
CREATE SEQUENCE IF NOT EXISTS cost_draft_sequence START 1;

-- Function to generate draft numbers
CREATE OR REPLACE FUNCTION public.generate_cost_draft_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    RETURN 'BOZZA-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('cost_draft_sequence')::TEXT, 4, '0');
END;
$$;

-- Trigger to auto-generate draft numbers
CREATE OR REPLACE FUNCTION public.auto_generate_cost_draft_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF NEW.draft_number IS NULL OR NEW.draft_number = '' THEN
        NEW.draft_number := generate_cost_draft_number();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER auto_generate_cost_draft_number_trigger
  BEFORE INSERT ON public.customer_cost_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_cost_draft_number();