-- Elimina tutte le policy esistenti per ricreale con il nuovo sistema
DROP POLICY IF EXISTS "Users can view profiles from same site" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Policy base per visualizzare il proprio profilo (sempre necessaria)
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Policy per visualizzare solo i profili dello stesso sito (per admin e moderatori)
CREATE POLICY "Users can view same site profiles" 
ON public.profiles 
FOR SELECT 
USING (
  -- L'utente può vedere profili dello stesso sito se ha un ruolo admin/moderator
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN profiles p1 ON ur.user_id = p1.id
    JOIN profiles p2 ON p1.site_origin = p2.site_origin
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin'::app_role, 'moderator'::app_role)
    AND p2.id = profiles.id
  )
);

-- Policy per aggiornare solo il proprio profilo
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy per inserire solo il proprio profilo
CREATE POLICY "Users can insert own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Aggiorna le RLS policies per user_roles per separare per sito
DROP POLICY IF EXISTS "Users can view roles from same site" ON public.user_roles;
DROP POLICY IF EXISTS "Site admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Policy per vedere i propri ruoli
CREATE POLICY "Users can view own roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy per admin che possono gestire i ruoli degli utenti del loro stesso sito
CREATE POLICY "Site admins can manage user roles" 
ON public.user_roles 
FOR ALL
USING (
  -- L'admin può gestire ruoli di utenti dello stesso sito
  EXISTS (
    SELECT 1 FROM user_roles ur1
    JOIN profiles p1 ON ur1.user_id = p1.id
    JOIN profiles p2 ON ur1.user_id = p2.id
    JOIN user_roles ur2 ON p2.id = ur2.user_id
    WHERE ur1.user_id = auth.uid() 
    AND ur1.role = 'admin'::app_role
    AND p1.site_origin = (
      SELECT site_origin FROM profiles WHERE id = user_roles.user_id
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur1
    JOIN profiles p1 ON ur1.user_id = p1.id
    WHERE ur1.user_id = auth.uid() 
    AND ur1.role = 'admin'::app_role
    AND p1.site_origin = (
      SELECT site_origin FROM profiles WHERE id = user_roles.user_id
    )
  )
);

-- Crea funzioni helper per gestire meglio la separazione dei siti
CREATE OR REPLACE FUNCTION public.get_user_site_origin(user_uuid uuid)
RETURNS TEXT AS $$
  SELECT site_origin FROM public.profiles WHERE id = user_uuid;
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_same_site_user(target_user_id uuid)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p1, profiles p2
    WHERE p1.id = auth.uid() 
    AND p2.id = target_user_id
    AND p1.site_origin = p2.site_origin
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;