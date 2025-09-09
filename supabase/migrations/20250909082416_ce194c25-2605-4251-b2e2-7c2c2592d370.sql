-- Allow admin users to insert new user roles
CREATE POLICY "Admins can insert user roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (has_minimum_role(auth.uid(), 'admin'::app_role));