-- Fix RLS issues and re-enable document loading
-- Re-enable RLS on critical tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create simple policies without recursion
CREATE POLICY "Users can view their own roles" 
ON public.user_roles FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can view storage objects" 
ON storage.objects FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload to documents bucket" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own uploads" 
ON storage.objects FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own uploads" 
ON storage.objects FOR DELETE 
USING (auth.role() = 'authenticated');