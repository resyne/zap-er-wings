-- Secure the crm_contacts table - Fix public access vulnerability

-- Remove all insecure policies that allow public access
DROP POLICY IF EXISTS "Allow authenticated users to view contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS "Allow authenticated users to insert contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS "Allow authenticated users to update contacts" ON public.crm_contacts;
DROP POLICY IF EXISTS "Allow authenticated users to delete contacts" ON public.crm_contacts;

-- Create secure role-based policies

-- Only authenticated users can view CRM contacts
CREATE POLICY "authenticated_users_can_view_contacts" 
ON public.crm_contacts 
FOR SELECT 
TO authenticated 
USING (true);

-- Only authenticated users can insert CRM contacts
CREATE POLICY "authenticated_users_can_insert_contacts" 
ON public.crm_contacts 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Only authenticated users can update CRM contacts
CREATE POLICY "authenticated_users_can_update_contacts" 
ON public.crm_contacts 
FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Only admin users can delete CRM contacts (more restrictive)
CREATE POLICY "admin_users_can_delete_contacts" 
ON public.crm_contacts 
FOR DELETE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::app_role
  )
);

-- Service role retains full access for edge functions and integrations
CREATE POLICY "service_role_full_access" 
ON public.crm_contacts 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;