
-- Allow users with 'user' role to insert/update/delete offer_items
CREATE POLICY "users_can_insert_offer_items"
ON public.offer_items
FOR INSERT
WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "users_can_update_offer_items"
ON public.offer_items
FOR UPDATE
USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "users_can_delete_offer_items"
ON public.offer_items
FOR DELETE
USING (has_minimum_role(auth.uid(), 'user'::app_role));
