-- Assign admin role to stanislao@abbattitorizapper.it
INSERT INTO public.user_roles (user_id, role)
VALUES ('e5700a72-a9f1-4865-97d4-569d73ff59be', 'admin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;