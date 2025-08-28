-- Remove all insecure policies that allow public access
DROP POLICY IF EXISTS "Allow authenticated users to view partners" ON public.partners;
DROP POLICY IF EXISTS "Allow authenticated users to insert partners" ON public.partners;
DROP POLICY IF EXISTS "Allow authenticated users to update partners" ON public.partners;
DROP POLICY IF EXISTS "Allow authenticated users to delete partners" ON public.partners;

-- Create secure role-based policies

-- Only authenticated users can view partners
CREATE POLICY "authenticated_users_can_view_partners" 
ON public.partners 
FOR SELECT 
TO authenticated 
USING (true);

-- Only authenticated users can insert partners
CREATE POLICY "authenticated_users_can_insert_partners" 
ON public.partners 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Only authenticated users can update partners
CREATE POLICY "authenticated_users_can_update_partners" 
ON public.partners 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Only admin users can delete partners (more restrictive)
CREATE POLICY "admin_users_can_delete_partners" 
ON public.partners 
FOR DELETE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::app_role
  )
);

-- Service role retains full access for edge functions
CREATE POLICY "service_role_full_access" 
ON public.partners 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;