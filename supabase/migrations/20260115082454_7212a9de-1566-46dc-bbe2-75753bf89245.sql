-- Add unique constraint for upsert on whatsapp_templates
ALTER TABLE public.whatsapp_templates
ADD CONSTRAINT whatsapp_templates_account_name_language_unique 
UNIQUE (account_id, name, language);