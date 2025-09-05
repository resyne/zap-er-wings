-- Add machinery_id column to cost_draft_items table
ALTER TABLE public.cost_draft_items 
ADD COLUMN machinery_id uuid REFERENCES public.boms(id);