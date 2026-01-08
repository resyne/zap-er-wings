-- Add attachments column to scadenza_movimenti for payment proof files
ALTER TABLE public.scadenza_movimenti 
ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT NULL;