-- Create a junction table for BOM inclusions (many-to-many relationship)
CREATE TABLE public.bom_inclusions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    parent_bom_id UUID NOT NULL REFERENCES public.boms(id) ON DELETE CASCADE,
    included_bom_id UUID NOT NULL REFERENCES public.boms(id) ON DELETE CASCADE,
    quantity NUMERIC NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(parent_bom_id, included_bom_id)
);

-- Create indexes for better performance
CREATE INDEX idx_bom_inclusions_parent ON public.bom_inclusions(parent_bom_id);
CREATE INDEX idx_bom_inclusions_included ON public.bom_inclusions(included_bom_id);

-- Add RLS policies for bom_inclusions
ALTER TABLE public.bom_inclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "moderators_can_manage_bom_inclusions" 
ON public.bom_inclusions 
FOR ALL 
USING (has_minimum_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_minimum_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "users_can_view_bom_inclusions" 
ON public.bom_inclusions 
FOR SELECT 
USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "service_role_full_access_bom_inclusions" 
ON public.bom_inclusions 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Add comments for clarity
COMMENT ON TABLE public.bom_inclusions IS 'Junction table for including BOMs within other BOMs';
COMMENT ON COLUMN public.bom_inclusions.parent_bom_id IS 'The BOM that includes other BOMs';
COMMENT ON COLUMN public.bom_inclusions.included_bom_id IS 'The BOM being included';
COMMENT ON COLUMN public.bom_inclusions.quantity IS 'Quantity of the included BOM needed';