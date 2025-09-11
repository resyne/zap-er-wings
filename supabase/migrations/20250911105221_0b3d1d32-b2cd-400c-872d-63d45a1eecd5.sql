-- Implement simple access control: default access for all, admin can restrict
-- First, create a table to manage page restrictions

CREATE TABLE IF NOT EXISTS public.user_page_restrictions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    page_path text NOT NULL,
    is_restricted boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    UNIQUE(user_id, page_path)
);

-- Enable RLS on restrictions table
ALTER TABLE public.user_page_restrictions ENABLE ROW LEVEL SECURITY;

-- Simple policy: only admins can manage restrictions
CREATE POLICY "Only admins can manage page restrictions" 
ON public.user_page_restrictions FOR ALL 
USING (auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role
))
WITH CHECK (auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role
));

-- Now simplify ALL existing policies to allow default access
-- Fix storage policies to be completely open for authenticated users
DROP POLICY IF EXISTS "Allow public read access to documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload to documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update documents bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete from documents bucket" ON storage.objects;

-- Create simple storage policies - default access for authenticated users
CREATE POLICY "Authenticated users can access documents storage" 
ON storage.objects FOR ALL 
USING (bucket_id = 'documents' AND auth.uid() IS NOT NULL)
WITH CHECK (bucket_id = 'documents' AND auth.uid() IS NOT NULL);