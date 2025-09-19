-- Update storage policies to allow moderators and users to upload company documents

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admin can upload company documents" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update company documents" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete company documents" ON storage.objects;
DROP POLICY IF EXISTS "Admin can view company documents" ON storage.objects;

-- Create more permissive policies for company documents
CREATE POLICY "Users can view company documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-documents');

CREATE POLICY "Moderators and admins can upload company documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'company-documents' 
  AND auth.uid() IN (
    SELECT user_id FROM user_roles 
    WHERE role IN ('admin'::app_role, 'moderator'::app_role, 'user'::app_role)
  )
);

CREATE POLICY "Moderators and admins can update company documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'company-documents' 
  AND auth.uid() IN (
    SELECT user_id FROM user_roles 
    WHERE role IN ('admin'::app_role, 'moderator'::app_role)
  )
);

CREATE POLICY "Moderators and admins can delete company documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'company-documents' 
  AND auth.uid() IN (
    SELECT user_id FROM user_roles 
    WHERE role IN ('admin'::app_role, 'moderator'::app_role)
  )
);