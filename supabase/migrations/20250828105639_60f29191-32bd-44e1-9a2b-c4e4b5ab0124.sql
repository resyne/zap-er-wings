-- Add user_type column to profiles table to distinguish between ERP and website users
ALTER TABLE public.profiles 
ADD COLUMN user_type TEXT DEFAULT 'website' CHECK (user_type IN ('erp', 'website'));

-- Update existing users based on email domain
UPDATE public.profiles 
SET user_type = 'erp' 
WHERE email LIKE '%@abbattitorizapper.it';

-- Update existing users to be website users if not ERP
UPDATE public.profiles 
SET user_type = 'website' 
WHERE email NOT LIKE '%@abbattitorizapper.it';