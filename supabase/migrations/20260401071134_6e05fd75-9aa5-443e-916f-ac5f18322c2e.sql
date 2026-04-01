ALTER TABLE public.email_list_contacts ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.email_list_contacts ADD COLUMN IF NOT EXISTS city text;