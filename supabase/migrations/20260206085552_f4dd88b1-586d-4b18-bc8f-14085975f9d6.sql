-- Create storage bucket for WhatsApp business files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-business-files', 
  'whatsapp-business-files', 
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']
);

-- Storage policies for whatsapp-business-files bucket
CREATE POLICY "Authenticated users can upload business files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-business-files');

CREATE POLICY "Authenticated users can view business files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'whatsapp-business-files');

CREATE POLICY "Authenticated users can delete business files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'whatsapp-business-files');

CREATE POLICY "Public can view business files"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'whatsapp-business-files');

-- Create table to track business files per WhatsApp account
CREATE TABLE public.whatsapp_business_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'image', 'video', 'audio', 'document'
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_business_files ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view business files"
ON public.whatsapp_business_files FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert business files"
ON public.whatsapp_business_files FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update business files"
ON public.whatsapp_business_files FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete business files"
ON public.whatsapp_business_files FOR DELETE
TO authenticated
USING (true);

-- Create index for faster lookups by account
CREATE INDEX idx_whatsapp_business_files_account ON public.whatsapp_business_files(account_id);

-- Add trigger for updated_at
CREATE TRIGGER update_whatsapp_business_files_updated_at
BEFORE UPDATE ON public.whatsapp_business_files
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();