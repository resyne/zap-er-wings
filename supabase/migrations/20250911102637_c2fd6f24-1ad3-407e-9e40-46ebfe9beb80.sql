-- Remove ALL policies that use has_minimum_role or similar functions causing recursion
-- This is a comprehensive fix to eliminate infinite recursion

-- Temporarily disable RLS on storage.objects to allow access
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Drop all problematic policies that reference user_roles table
DROP POLICY IF EXISTS "Users can view their own role simple" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- Completely disable RLS on user_roles table for now
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- Create basic public access for storage objects (documents)
CREATE POLICY "Public can view company documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'company-documents');

-- Re-enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create simple policies for user_roles that don't cause recursion
CREATE POLICY "Simple user role access" 
ON public.user_roles 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Re-enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;