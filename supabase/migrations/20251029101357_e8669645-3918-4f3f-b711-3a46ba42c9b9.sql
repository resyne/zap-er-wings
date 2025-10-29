-- Allow public access to offer_items for offers with a valid unique_code
CREATE POLICY "public_can_view_offer_items_via_unique_code"
ON offer_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM offers
    WHERE offers.id = offer_items.offer_id
    AND offers.unique_code IS NOT NULL
  )
);