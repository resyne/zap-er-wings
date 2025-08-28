-- Secure the quote_requests table - Fix public access vulnerability

-- Remove all insecure policies that allow public access
DROP POLICY IF EXISTS "Allow all inserts for quote requests" ON public.quote_requests;
DROP POLICY IF EXISTS "Allow read quote requests" ON public.quote_requests;
DROP POLICY IF EXISTS "Allow update own quote requests" ON public.quote_requests;
DROP POLICY IF EXISTS "Allow delete own quote requests" ON public.quote_requests;

-- Create secure role-based policies

-- Only authenticated users can view their own quote requests or admins can view all
CREATE POLICY "authenticated_users_can_view_own_quote_requests" 
ON public.quote_requests 
FOR SELECT 
TO authenticated 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::app_role
  )
);

-- Allow authenticated users to insert quote requests (with proper user_id)
CREATE POLICY "authenticated_users_can_insert_quote_requests" 
ON public.quote_requests 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Allow users to update their own quote requests
CREATE POLICY "users_can_update_own_quote_requests" 
ON public.quote_requests 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id AND user_id IS NOT NULL)
WITH CHECK (auth.uid() = user_id AND user_id IS NOT NULL);

-- Allow users to delete their own quote requests
CREATE POLICY "users_can_delete_own_quote_requests" 
ON public.quote_requests 
FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id AND user_id IS NOT NULL);

-- Service role retains full access for edge functions
CREATE POLICY "service_role_full_access" 
ON public.quote_requests 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;