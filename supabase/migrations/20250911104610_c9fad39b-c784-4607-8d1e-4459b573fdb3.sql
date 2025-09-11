-- Create proper RLS policies for documents bucket
-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can view storage objects" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own uploads" ON storage.objects;

-- Create specific policies for documents bucket
CREATE POLICY "Public can view documents bucket" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'documents');

CREATE POLICY "Authenticated users can upload to documents bucket" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update documents bucket" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete from documents bucket" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'documents' AND auth.role() = 'authenticated');