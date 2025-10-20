-- Add hide_amounts column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS hide_amounts BOOLEAN DEFAULT false;

-- Create a security definer function to check if current user should hide amounts
CREATE OR REPLACE FUNCTION public.should_hide_amounts()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT hide_amounts FROM public.profiles WHERE id = auth.uid()),
    false
  )
$$;