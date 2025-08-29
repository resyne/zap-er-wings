-- Add level and parent_id columns to boms table for hierarchical structure
ALTER TABLE public.boms 
ADD COLUMN level INTEGER NOT NULL DEFAULT 0,
ADD COLUMN parent_id UUID REFERENCES public.boms(id) ON DELETE CASCADE,
ADD COLUMN machinery_model TEXT;

-- Add constraint to ensure level is between 0 and 2
ALTER TABLE public.boms 
ADD CONSTRAINT boms_level_check CHECK (level >= 0 AND level <= 2);

-- Create index for better performance on hierarchical queries
CREATE INDEX idx_boms_parent_id ON public.boms(parent_id);
CREATE INDEX idx_boms_level ON public.boms(level);

-- Add comments for clarity
COMMENT ON COLUMN public.boms.level IS 'Hierarchy level: 0=machinery model, 1=parent group, 2=child element';
COMMENT ON COLUMN public.boms.parent_id IS 'Reference to parent BOM for hierarchical structure';
COMMENT ON COLUMN public.boms.machinery_model IS 'Machinery model name (only for level 0 BOMs)';