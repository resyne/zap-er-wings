-- Update profiles RLS policies to filter by site_origin
DROP POLICY IF EXISTS "authenticated_users_can_view_contacts" ON public.profiles;
DROP POLICY IF EXISTS "authenticated_users_can_update_contacts" ON public.profiles;
DROP POLICY IF EXISTS "authenticated_users_can_insert_contacts" ON public.profiles;

-- Create new RLS policies that filter by site_origin
CREATE POLICY "Users can view profiles from same site"
ON public.profiles
FOR SELECT
USING (
  site_origin = 'zap-er-wings.lovable.app' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (
  auth.uid() = id AND
  site_origin = 'zap-er-wings.lovable.app'
);