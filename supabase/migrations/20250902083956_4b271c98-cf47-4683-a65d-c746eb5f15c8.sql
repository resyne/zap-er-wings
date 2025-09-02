-- Add website and notes columns to partners table
ALTER TABLE public.partners 
ADD COLUMN website text,
ADD COLUMN notes text;