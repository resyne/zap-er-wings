-- Add template_name column for generic template selection
-- The AI will select the correct language variant at runtime based on lead's country
ALTER TABLE public.whatsapp_automation_steps 
ADD COLUMN template_name TEXT;

-- Create index for faster lookups
CREATE INDEX idx_whatsapp_automation_steps_template_name 
ON public.whatsapp_automation_steps(template_name);

-- Add comment for clarity
COMMENT ON COLUMN public.whatsapp_automation_steps.template_name IS 
'Generic template name (without language). AI will select correct language variant at runtime based on lead country.';