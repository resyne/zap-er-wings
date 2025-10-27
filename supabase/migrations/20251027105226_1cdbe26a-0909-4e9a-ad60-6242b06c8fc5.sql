-- Add RLS policies for order-files bucket
-- Allow authenticated users to view files
CREATE POLICY "Authenticated users can view order files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'order-files');

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload order files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'order-files' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to update files
CREATE POLICY "Authenticated users can update order files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'order-files' AND auth.uid() IS NOT NULL);

-- Allow authenticated users to delete files
CREATE POLICY "Authenticated users can delete order files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'order-files' AND auth.uid() IS NOT NULL);