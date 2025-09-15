-- Create table for brand assets
CREATE TABLE public.brand_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_name TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('color', 'icon', 'logo')),
  asset_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create trigger for updated_at
CREATE TRIGGER update_brand_assets_updated_at
  BEFORE UPDATE ON public.brand_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage brand assets" 
ON public.brand_assets 
FOR ALL 
USING (has_minimum_role(auth.uid(), 'user'::app_role))
WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Service role full access brand assets" 
ON public.brand_assets 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create storage bucket for brand assets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('brand-assets', 'brand-assets', true);

-- Create storage policies
CREATE POLICY "Users can upload brand assets" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'brand-assets' AND has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can view brand assets" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'brand-assets');

CREATE POLICY "Users can update brand assets" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'brand-assets' AND has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can delete brand assets" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'brand-assets' AND has_minimum_role(auth.uid(), 'user'::app_role));