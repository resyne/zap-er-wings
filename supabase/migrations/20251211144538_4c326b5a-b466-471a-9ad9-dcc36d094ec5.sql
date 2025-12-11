-- Add approval tracking fields to offers table
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS approved boolean DEFAULT false;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS approved_by_name text;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;