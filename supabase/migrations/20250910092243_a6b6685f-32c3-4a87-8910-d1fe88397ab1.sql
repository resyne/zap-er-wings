-- Risolvi la ricorsione infinita nelle policy RLS per profiles
-- Elimina le policy problematiche
DROP POLICY IF EXISTS "Users can view same site profiles" ON public.profiles;
DROP POLICY IF EXISTS "Site admins can manage user roles" ON public.user_roles;

-- Crea una policy più semplice per visualizzare profili dello stesso sito
-- Gli admin possono vedere tutti i profili del loro sito
CREATE POLICY "Admins can view same site profiles" 
ON public.profiles 
FOR SELECT 
USING (
  -- Se l'utente è admin, può vedere profili dello stesso sito
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'admin'::app_role
    AND EXISTS (
      SELECT 1 FROM profiles p1, profiles p2
      WHERE p1.id = auth.uid()
      AND p2.id = profiles.id
      AND p1.site_origin = p2.site_origin
    )
  )
);

-- Semplifica la policy per la gestione dei ruoli
CREATE POLICY "Admins can manage same site user roles" 
ON public.user_roles 
FOR ALL
USING (
  -- Solo gli admin possono gestire i ruoli, e solo per utenti dello stesso sito
  EXISTS (
    SELECT 1 FROM user_roles ur_admin
    JOIN profiles p_admin ON ur_admin.user_id = p_admin.id
    JOIN profiles p_target ON user_roles.user_id = p_target.id
    WHERE ur_admin.user_id = auth.uid() 
    AND ur_admin.role = 'admin'::app_role
    AND p_admin.site_origin = p_target.site_origin
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur_admin
    JOIN profiles p_admin ON ur_admin.user_id = p_admin.id
    JOIN profiles p_target ON user_roles.user_id = p_target.id
    WHERE ur_admin.user_id = auth.uid() 
    AND ur_admin.role = 'admin'::app_role
    AND p_admin.site_origin = p_target.site_origin
  )
);