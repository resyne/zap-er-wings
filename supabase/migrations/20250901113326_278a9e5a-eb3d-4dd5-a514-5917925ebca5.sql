-- Create storage bucket for marketing materials
INSERT INTO storage.buckets (id, name, public) VALUES ('marketing-materials', 'marketing-materials', true);

-- Create marketing_materials table for organizing files
CREATE TABLE public.marketing_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  equipment_type TEXT NOT NULL CHECK (equipment_type IN ('abbattitori', 'forni')),
  category TEXT NOT NULL CHECK (category IN ('media_professionale', 'creative_advertising')),
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  tags TEXT[],
  description TEXT
);

-- Enable RLS
ALTER TABLE public.marketing_materials ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view marketing materials" 
ON public.marketing_materials 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Moderators can manage marketing materials" 
ON public.marketing_materials 
FOR ALL 
USING (has_minimum_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_minimum_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Users can upload marketing materials" 
ON public.marketing_materials 
FOR INSERT 
WITH CHECK (auth.uid() = uploaded_by);

-- Create storage policies for marketing materials bucket
CREATE POLICY "Authenticated users can view marketing materials files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'marketing-materials' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload marketing materials files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'marketing-materials' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own marketing materials files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'marketing-materials' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Moderators can delete marketing materials files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'marketing-materials' AND has_minimum_role(auth.uid(), 'moderator'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_marketing_materials_updated_at
BEFORE UPDATE ON public.marketing_materials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();