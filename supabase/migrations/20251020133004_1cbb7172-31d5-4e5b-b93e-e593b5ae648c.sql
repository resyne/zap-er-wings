-- Allow all authenticated users to view other users' profiles for tagging purposes
DROP POLICY IF EXISTS "Users can view all profiles for tagging" ON public.profiles;

CREATE POLICY "Users can view all profiles for tagging"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Ensure users can still update only their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);