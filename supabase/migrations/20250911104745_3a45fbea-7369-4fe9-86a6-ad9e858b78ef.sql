-- Fix infinite recursion by creating simpler storage policies
-- Drop problematic policies
DROP POLICY IF EXISTS "Public can view documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from documents bucket" ON storage.objects;

-- Create simple policies that don't reference user_roles table
CREATE POLICY "Allow public read access to documents bucket" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'documents');

CREATE POLICY "Allow authenticated users to upload to documents bucket" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to update documents bucket" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Allow authenticated users to delete from documents bucket" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL);