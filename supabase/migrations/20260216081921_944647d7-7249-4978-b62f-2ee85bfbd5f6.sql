-- Fix SELECT policy: change from public to authenticated role
DROP POLICY IF EXISTS "Authenticated users can view WhatsApp templates" ON public.whatsapp_templates;

CREATE POLICY "Authenticated users can view WhatsApp templates"
ON public.whatsapp_templates
FOR SELECT
TO authenticated
USING (true);