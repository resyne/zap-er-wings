-- Fix missing profiles for existing users with roles
-- First, ensure the trigger function exists and is correct
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  );
  RETURN new;
END;
$$;

-- Recreate the trigger to ensure it's active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Create missing profiles for users who have roles but no profile
INSERT INTO public.profiles (id, email, first_name, last_name)
SELECT 
  au.id,
  au.email,
  au.raw_user_meta_data ->> 'first_name' as first_name,
  au.raw_user_meta_data ->> 'last_name' as last_name
FROM auth.users au
INNER JOIN public.user_roles ur ON au.id = ur.user_id
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;