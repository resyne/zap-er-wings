
-- Add anon role policies for whatsapp_templates to match other tables
CREATE POLICY "Anon users can view WhatsApp templates"
ON public.whatsapp_templates
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Anon users can insert WhatsApp templates"
ON public.whatsapp_templates
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Anon users can update WhatsApp templates"
ON public.whatsapp_templates
FOR UPDATE
TO anon
USING (true);

CREATE POLICY "Anon users can delete WhatsApp templates"
ON public.whatsapp_templates
FOR DELETE
TO anon
USING (true);
