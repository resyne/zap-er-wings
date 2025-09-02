-- Add description field to boms table for better offer integration
ALTER TABLE public.boms ADD COLUMN description TEXT;