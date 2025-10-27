-- Create shipping_order_comments table
CREATE TABLE IF NOT EXISTS shipping_order_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_order_id UUID NOT NULL REFERENCES shipping_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  comment TEXT NOT NULL,
  tagged_users UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE shipping_order_comments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "users_can_view_shipping_order_comments"
ON shipping_order_comments
FOR SELECT
USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "users_can_create_shipping_order_comments"
ON shipping_order_comments
FOR INSERT
WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role) AND auth.uid() = user_id);

CREATE POLICY "users_can_update_own_comments"
ON shipping_order_comments
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_can_delete_own_comments"
ON shipping_order_comments
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "service_role_full_access_shipping_order_comments"
ON shipping_order_comments
FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_shipping_order_comments_updated_at
  BEFORE UPDATE ON shipping_order_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for user tagging notifications
CREATE TRIGGER notify_tagged_users_in_shipping_order_comments
  AFTER INSERT ON shipping_order_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_user_tagged();

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_shipping_order_comments_shipping_order_id ON shipping_order_comments(shipping_order_id);
CREATE INDEX IF NOT EXISTS idx_shipping_order_comments_user_id ON shipping_order_comments(user_id);