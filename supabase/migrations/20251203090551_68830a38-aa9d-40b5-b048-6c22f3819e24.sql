-- Create storage buckets for work order files
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('production-files', 'production-files', true),
  ('service-files', 'service-files', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for production-files bucket
CREATE POLICY "Anyone can view production files"
ON storage.objects FOR SELECT
USING (bucket_id = 'production-files');

CREATE POLICY "Authenticated users can upload production files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'production-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update production files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'production-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete production files"
ON storage.objects FOR DELETE
USING (bucket_id = 'production-files' AND auth.role() = 'authenticated');

-- RLS policies for service-files bucket
CREATE POLICY "Anyone can view service files"
ON storage.objects FOR SELECT
USING (bucket_id = 'service-files');

CREATE POLICY "Authenticated users can upload service files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'service-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update service files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'service-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete service files"
ON storage.objects FOR DELETE
USING (bucket_id = 'service-files' AND auth.role() = 'authenticated');