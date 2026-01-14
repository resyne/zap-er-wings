-- Add meta_template_id column to whatsapp_templates
ALTER TABLE public.whatsapp_templates 
ADD COLUMN IF NOT EXISTS meta_template_id TEXT;