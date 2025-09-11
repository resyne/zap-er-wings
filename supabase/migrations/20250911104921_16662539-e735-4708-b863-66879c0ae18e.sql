-- EMERGENCY FIX: Remove all recursive policies on user_roles table
-- This will break some authorization checks but will fix the infinite recursion

-- Drop all existing policies on user_roles
DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage same site user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Allow all access to user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role simple" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "admins_can_manage_roles" ON public.user_roles;
DROP POLICY IF EXISTS "users_can_view_own_roles" ON public.user_roles;

-- Temporarily disable RLS on user_roles to stop recursion
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- Enable basic RLS policies that don't cause recursion
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies
CREATE POLICY "Simple user can view own roles" 
ON public.user_roles FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Simple authenticated users can insert roles" 
ON public.user_roles FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);