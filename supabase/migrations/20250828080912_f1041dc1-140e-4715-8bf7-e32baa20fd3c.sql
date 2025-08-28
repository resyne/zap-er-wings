-- Add region column to partners table
ALTER TABLE public.partners 
ADD COLUMN region text;