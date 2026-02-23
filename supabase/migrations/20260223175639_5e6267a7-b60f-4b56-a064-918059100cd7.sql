
-- Allow any authenticated user to insert communications
DROP POLICY IF EXISTS "Admins and moderators can create communications" ON public.internal_communications;

CREATE POLICY "Authenticated users can create communications"
ON public.internal_communications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id);
