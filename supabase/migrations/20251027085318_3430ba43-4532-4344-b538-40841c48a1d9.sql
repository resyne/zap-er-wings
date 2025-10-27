-- Add archived column to offers table
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- Create index for archived column for better query performance
CREATE INDEX IF NOT EXISTS idx_offers_archived ON public.offers(archived);