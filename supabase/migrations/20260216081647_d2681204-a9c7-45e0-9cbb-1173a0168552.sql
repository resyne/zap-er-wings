-- Drop the ALL policy and create specific ones
DROP POLICY IF EXISTS "Authenticated users can manage WhatsApp templates" ON public.whatsapp_templates;

-- Create specific policies
CREATE POLICY "Authenticated users can insert WhatsApp templates"
ON public.whatsapp_templates
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update WhatsApp templates"
ON public.whatsapp_templates
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete WhatsApp templates"
ON public.whatsapp_templates
FOR DELETE
TO authenticated
USING (true);