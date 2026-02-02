-- Create storage bucket for WhatsApp media (template images, documents, videos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-media', 
  'whatsapp-media', 
  true,
  16777216, -- 16MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload whatsapp media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-media');

-- Allow authenticated users to update their files
CREATE POLICY "Authenticated users can update whatsapp media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'whatsapp-media');

-- Allow public read access (needed for WhatsApp API to fetch media)
CREATE POLICY "Public can read whatsapp media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'whatsapp-media');

-- Allow authenticated users to delete their files
CREATE POLICY "Authenticated users can delete whatsapp media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'whatsapp-media');