-- Create storage bucket for WaSender media files
INSERT INTO storage.buckets (id, name, public)
VALUES ('wasender-media', 'wasender-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Users can upload wasender media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'wasender-media' AND auth.role() = 'authenticated');

-- Allow authenticated users to read files
CREATE POLICY "Users can view wasender media"
ON storage.objects FOR SELECT
USING (bucket_id = 'wasender-media' AND auth.role() = 'authenticated');

-- Allow public access to read files (needed for WaSender API to fetch)
CREATE POLICY "Public can view wasender media"
ON storage.objects FOR SELECT
USING (bucket_id = 'wasender-media');

-- Allow authenticated users to delete their files
CREATE POLICY "Users can delete wasender media"
ON storage.objects FOR DELETE
USING (bucket_id = 'wasender-media' AND auth.role() = 'authenticated');