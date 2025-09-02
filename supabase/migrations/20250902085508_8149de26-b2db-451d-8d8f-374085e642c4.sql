-- Add price lists and pricing notes to partners table
ALTER TABLE public.partners 
ADD COLUMN price_lists jsonb DEFAULT '[]'::jsonb,
ADD COLUMN pricing_notes text;