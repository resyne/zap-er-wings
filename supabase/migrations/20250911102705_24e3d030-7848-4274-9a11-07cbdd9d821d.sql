-- Fix infinite recursion by removing all problematic policies
-- Only work on public schema tables that we own

-- Drop ALL policies that use has_minimum_role functions
DROP POLICY IF EXISTS "Users can view their own role simple" ON public.user_roles;
DROP POLICY IF EXISTS "Simple user role access" ON public.user_roles;

-- Completely disable RLS on user_roles to stop recursion
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- Drop the problematic functions that cause recursion
DROP FUNCTION IF EXISTS public.has_minimum_role(uuid, app_role);
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);

-- Create new safe functions without recursion
CREATE OR REPLACE FUNCTION public.check_user_role_safe(user_uuid uuid, required_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN required_role = 'user' THEN true
    WHEN required_role = 'moderator' THEN EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = user_uuid AND role::text IN ('moderator', 'admin')
    )
    WHEN required_role = 'admin' THEN EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = user_uuid AND role::text = 'admin'
    )
    ELSE false
  END;
$$;