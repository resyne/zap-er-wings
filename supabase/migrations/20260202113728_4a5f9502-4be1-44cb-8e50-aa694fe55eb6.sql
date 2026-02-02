-- Add is_disabled column to whatsapp_templates table
ALTER TABLE public.whatsapp_templates 
ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.whatsapp_templates.is_disabled IS 'Whether the template is manually disabled by the user';