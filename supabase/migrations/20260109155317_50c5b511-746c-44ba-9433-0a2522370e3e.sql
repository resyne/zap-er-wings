
-- Create business_units table
CREATE TABLE public.business_units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view business units"
ON public.business_units FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage business units"
ON public.business_units FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Add business_unit_id to strategic tables
ALTER TABLE public.strategic_visions 
ADD COLUMN business_unit_id UUID REFERENCES public.business_units(id) ON DELETE CASCADE;

ALTER TABLE public.strategic_focus 
ADD COLUMN business_unit_id UUID REFERENCES public.business_units(id) ON DELETE CASCADE;

ALTER TABLE public.strategic_objectives 
ADD COLUMN business_unit_id UUID REFERENCES public.business_units(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX idx_strategic_visions_business_unit ON public.strategic_visions(business_unit_id);
CREATE INDEX idx_strategic_focus_business_unit ON public.strategic_focus(business_unit_id);
CREATE INDEX idx_strategic_objectives_business_unit ON public.strategic_objectives(business_unit_id);

-- Insert default business units
INSERT INTO public.business_units (name, code, color, description) VALUES
('ZAPPER', 'ZAPPER', '#F97316', 'Forni professionali ZAPPER'),
('VESUVIANO', 'VESUVIANO', '#EF4444', 'Forni a legna VESUVIANO');

-- Update trigger
CREATE TRIGGER update_business_units_updated_at
BEFORE UPDATE ON public.business_units
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
