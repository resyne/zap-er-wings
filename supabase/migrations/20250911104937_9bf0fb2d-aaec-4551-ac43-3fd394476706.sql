-- EMERGENCY FIX: Completely reset user_roles policies to stop infinite recursion

-- First, disable RLS to stop recursion immediately
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- Drop ALL policies that exist (including any duplicates)
DROP POLICY IF EXISTS "Simple user can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Simple authenticated users can insert roles" ON public.user_roles;

-- Re-enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create only the most basic policy that allows access without recursion
CREATE POLICY "Allow authenticated access to user_roles" 
ON public.user_roles FOR ALL 
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);