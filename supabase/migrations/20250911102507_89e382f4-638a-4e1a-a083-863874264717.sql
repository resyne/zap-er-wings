-- Remove all problematic RLS policies that cause infinite recursion
-- Start with completely disabling RLS on user_roles to break the cycle
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies on user_roles
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- Create a simple function to get user role without RLS
CREATE OR REPLACE FUNCTION public.get_user_role_simple(user_uuid uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.user_roles WHERE user_id = user_uuid LIMIT 1;
$$;

-- Create a simpler role check function
CREATE OR REPLACE FUNCTION public.is_user_admin(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = user_uuid AND role = 'admin'::app_role
  );
$$;

-- Create basic policies for user_roles without recursion
CREATE POLICY "Users can view own role simple" 
ON public.user_roles 
FOR SELECT 
USING (user_id = auth.uid());

-- Re-enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;