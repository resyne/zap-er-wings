-- Aggiorna le RLS policies per profiles per separare gli utenti per sito
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Policy per visualizzare solo i profili dello stesso sito
CREATE POLICY "Users can view profiles from same site" 
ON public.profiles 
FOR SELECT 
USING (
  site_origin = COALESCE(
    (auth.jwt() ->> 'site_origin'),
    'zap-er-wings.lovable.app'
  )
);

-- Policy per aggiornare solo il proprio profilo
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy per inserire solo il proprio profilo con il sito corretto
CREATE POLICY "Users can insert own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  auth.uid() = id AND 
  site_origin = COALESCE(
    (auth.jwt() ->> 'site_origin'),
    'zap-er-wings.lovable.app'
  )
);

-- Policy per admin che possono vedere tutti i profili
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  )
);

-- Aggiorna la funzione handle_new_user per gestire meglio il site_origin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  site_domain TEXT;
BEGIN
  -- Determina il sito di origine dai metadati o dall'header
  site_domain := COALESCE(
    new.raw_user_meta_data ->> 'site_origin',
    'zap-er-wings.lovable.app'
  );
  
  INSERT INTO public.profiles (id, email, first_name, last_name, site_origin)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    site_domain
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Aggiorna anche le RLS policies per user_roles per separare per sito
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Policy per vedere solo i ruoli degli utenti dello stesso sito
CREATE POLICY "Users can view roles from same site" 
ON public.user_roles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = user_roles.user_id 
    AND p.site_origin = COALESCE(
      (SELECT site_origin FROM profiles WHERE id = auth.uid()),
      'zap-er-wings.lovable.app'
    )
  )
);

-- Policy per admin che possono gestire i ruoli nel loro sito
CREATE POLICY "Site admins can manage roles" 
ON public.user_roles 
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN profiles p ON ur.user_id = p.id
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'admin'::app_role
    AND p.site_origin = COALESCE(
      (SELECT p2.site_origin FROM profiles p2 
       JOIN user_roles ur2 ON p2.id = ur2.user_id 
       WHERE ur2.user_id = user_roles.user_id),
      'zap-er-wings.lovable.app'
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN profiles p ON ur.user_id = p.id
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'admin'::app_role
    AND p.site_origin = COALESCE(
      (SELECT p2.site_origin FROM profiles p2 WHERE p2.id = user_roles.user_id),
      'zap-er-wings.lovable.app'
    )
  )
);

-- Crea una funzione per ottenere il site_origin dell'utente corrente
CREATE OR REPLACE FUNCTION public.get_current_user_site()
RETURNS TEXT AS $$
  SELECT site_origin FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;