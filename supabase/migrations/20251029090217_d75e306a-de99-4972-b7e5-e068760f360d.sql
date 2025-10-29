-- Add reverse_charge column to offers table
ALTER TABLE public.offers 
ADD COLUMN IF NOT EXISTS reverse_charge BOOLEAN DEFAULT false;