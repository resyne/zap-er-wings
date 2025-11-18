-- Create oven models table
CREATE TABLE IF NOT EXISTS public.oven_models (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  power_types TEXT[] DEFAULT ARRAY['Elettrico', 'Gas', 'Legna'],
  sizes_available INTEGER[] DEFAULT ARRAY[80, 100, 120, 130],
  image_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  video_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add image and video urls to product_configurations
ALTER TABLE public.product_configurations 
ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS video_urls TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Create storage buckets for oven models media
INSERT INTO storage.buckets (id, name, public)
VALUES ('oven-models', 'oven-models', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for oven models
CREATE POLICY "Public can view oven model files"
ON storage.objects FOR SELECT
USING (bucket_id = 'oven-models');

CREATE POLICY "Authenticated users can upload oven model files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'oven-models' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update oven model files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'oven-models' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete oven model files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'oven-models' AND
  auth.role() = 'authenticated'
);

-- Enable RLS on oven_models table
ALTER TABLE public.oven_models ENABLE ROW LEVEL SECURITY;

-- RLS policies for oven_models
CREATE POLICY "Everyone can view oven models"
ON public.oven_models FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert oven models"
ON public.oven_models FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update oven models"
ON public.oven_models FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete oven models"
ON public.oven_models FOR DELETE
USING (auth.role() = 'authenticated');

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_oven_models_name ON public.oven_models(name);
CREATE INDEX IF NOT EXISTS idx_oven_models_is_active ON public.oven_models(is_active);

-- Insert default models if they don't exist
INSERT INTO public.oven_models (name, power_types, sizes_available)
VALUES 
  ('Sebastian', ARRAY['Elettrico', 'Gas', 'Legna'], ARRAY[80, 100, 120, 130]),
  ('Realbosco', ARRAY['Elettrico', 'Gas', 'Legna', 'Rotante'], ARRAY[80, 100, 120, 130]),
  ('Anastasia', ARRAY['Elettrico', 'Gas', 'Legna'], ARRAY[80, 100, 120, 130]),
  ('Ottavio', ARRAY['Gas', 'Legna'], ARRAY[80, 100, 120, 130])
ON CONFLICT (name) DO NOTHING;