-- Create policies for storage.objects to allow authenticated users to manage company-documents

-- Policy for users to upload files to company-documents bucket
CREATE POLICY "Users can upload to company-documents bucket" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'company-documents' AND auth.role() = 'authenticated');

-- Policy for users to view files in company-documents bucket  
CREATE POLICY "Users can view company-documents files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'company-documents' AND auth.role() = 'authenticated');

-- Policy for users to update files in company-documents bucket
CREATE POLICY "Users can update company-documents files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'company-documents' AND auth.role() = 'authenticated');

-- Policy for users to delete files in company-documents bucket
CREATE POLICY "Users can delete company-documents files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'company-documents' AND auth.role() = 'authenticated');