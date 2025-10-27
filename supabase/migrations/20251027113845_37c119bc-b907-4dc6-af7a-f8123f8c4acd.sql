-- Enable RLS on shipping_orders table
ALTER TABLE shipping_orders ENABLE ROW LEVEL SECURITY;

-- Allow users with minimum role 'user' to view shipping orders
CREATE POLICY "users_can_view_shipping_orders"
ON shipping_orders
FOR SELECT
USING (has_minimum_role(auth.uid(), 'user'::app_role));

-- Allow moderators to manage all shipping orders
CREATE POLICY "moderators_can_manage_shipping_orders"
ON shipping_orders
FOR ALL
USING (has_minimum_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_minimum_role(auth.uid(), 'moderator'::app_role));

-- Allow service role full access
CREATE POLICY "service_role_full_access_shipping_orders"
ON shipping_orders
FOR ALL
USING (true)
WITH CHECK (true);