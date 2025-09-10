-- Risolvi definitivamente la ricorsione infinita nelle RLS policies
-- Elimina tutte le policy problematiche per profiles
DROP POLICY IF EXISTS "Admins can view same site profiles" ON public.profiles;

-- Crea policy più semplice che evita la ricorsione
-- Gli utenti possono vedere solo il proprio profilo
-- Gli admin possono vedere tutti i profili (senza controllo del sito per ora)
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  -- L'utente può sempre vedere il proprio profilo
  auth.uid() = id
  OR
  -- Oppure è un admin (controllo diretto sui ruoli senza join con profiles)
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::app_role
  )
);