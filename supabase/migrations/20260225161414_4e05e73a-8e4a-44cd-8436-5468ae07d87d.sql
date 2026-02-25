INSERT INTO public.user_roles (user_id, role)
VALUES ('b44aa182-6a72-47e9-95c9-9b48556547e0', 'user')
ON CONFLICT (user_id, role) DO NOTHING;