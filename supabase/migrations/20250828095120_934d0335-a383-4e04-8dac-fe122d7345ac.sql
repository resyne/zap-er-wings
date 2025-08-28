-- Remove the insecure policy that allows public access
DROP POLICY IF EXISTS "Allow service role to access contact submissions" ON public.contact_submissions;

-- Create secure policy that ONLY allows service role access
CREATE POLICY "service_role_only_access" 
ON public.contact_submissions 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Create policy for authenticated admins to view submissions (optional - only if needed)
CREATE POLICY "admins_can_view_submissions" 
ON public.contact_submissions 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::app_role
  )
);

-- Ensure RLS is enabled
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;