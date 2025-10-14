-- First, get the list of website users to delete (excluding Bruno)
DO $$
DECLARE
  website_user_ids UUID[];
BEGIN
  -- Get all website user IDs except Bruno
  SELECT ARRAY_AGG(id) INTO website_user_ids
  FROM public.profiles
  WHERE user_type = 'website'
  AND email != 'bruno@abbattitorizapper.it';
  
  -- Update tasks assigned to these users - set assigned_to to NULL
  UPDATE public.tasks
  SET assigned_to = NULL
  WHERE assigned_to = ANY(website_user_ids);
  
  -- Update tasks created by these users - set created_by to NULL
  UPDATE public.tasks
  SET created_by = NULL
  WHERE created_by = ANY(website_user_ids);
  
  -- Delete any other references if needed
  -- Add more UPDATE statements here for other tables that might reference these users
  
END $$;

-- Now update Bruno's profile to ERP type
UPDATE public.profiles
SET user_type = 'erp',
    updated_at = now()
WHERE email = 'bruno@abbattitorizapper.it';

-- Add moderator role for Bruno
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'moderator'::app_role
FROM public.profiles
WHERE email = 'bruno@abbattitorizapper.it'
ON CONFLICT (user_id, role) DO NOTHING;

-- Delete all website users except Bruno
DELETE FROM auth.users
WHERE id IN (
  SELECT id FROM public.profiles
  WHERE user_type = 'website'
  AND email != 'bruno@abbattitorizapper.it'
);