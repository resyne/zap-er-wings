-- Check if there are any RLS policies for storage.objects related to company-documents bucket
-- and create them if missing

-- Policy for SELECT (viewing files)
INSERT INTO storage.objects (bucket_id, name, owner, path_tokens, version, metadata, created_at, updated_at)
SELECT 'company-documents', '', auth.uid(), '{}', null, '{}', now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM storage.objects WHERE bucket_id = 'company-documents' LIMIT 1
);

-- Create policy for users to upload their own files to company-documents bucket
CREATE POLICY IF NOT EXISTS "Users can upload to company-documents bucket" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'company-documents' AND auth.role() = 'authenticated');

-- Create policy for users to view files in company-documents bucket  
CREATE POLICY IF NOT EXISTS "Users can view company-documents files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'company-documents' AND auth.role() = 'authenticated');

-- Create policy for users to update files in company-documents bucket
CREATE POLICY IF NOT EXISTS "Users can update company-documents files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'company-documents' AND auth.role() = 'authenticated');

-- Create policy for users to delete files in company-documents bucket
CREATE POLICY IF NOT EXISTS "Users can delete company-documents files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'company-documents' AND auth.role() = 'authenticated');