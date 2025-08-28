-- Add policy for admins to view all profiles
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  -- User can see their own profile OR user is admin
  auth.uid() = id OR 
  has_role(auth.uid(), 'admin'::app_role)
);

-- Add policy for admins to manage all profiles  
CREATE POLICY "Admins can manage all profiles" 
ON public.profiles 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));