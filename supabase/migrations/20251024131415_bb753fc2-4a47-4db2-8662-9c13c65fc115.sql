-- Add article column to work_orders, service_work_orders and shipping_orders
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS article text;
ALTER TABLE service_work_orders ADD COLUMN IF NOT EXISTS article text;
ALTER TABLE shipping_orders ADD COLUMN IF NOT EXISTS article text;

-- Create work_order_comments table
CREATE TABLE IF NOT EXISTS work_order_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  tagged_users uuid[] DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create service_work_order_comments table
CREATE TABLE IF NOT EXISTS service_work_order_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_work_order_id uuid NOT NULL REFERENCES service_work_orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  tagged_users uuid[] DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create shipping_order_comments table
CREATE TABLE IF NOT EXISTS shipping_order_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shipping_order_id uuid NOT NULL REFERENCES shipping_orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  tagged_users uuid[] DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on comment tables
ALTER TABLE work_order_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_work_order_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_order_comments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for work_order_comments
CREATE POLICY "Users can view work order comments" ON work_order_comments
  FOR SELECT USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can create work order comments" ON work_order_comments
  FOR INSERT WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role) AND auth.uid() = user_id);

CREATE POLICY "Users can delete their own work order comments" ON work_order_comments
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access work order comments" ON work_order_comments
  FOR ALL USING (true) WITH CHECK (true);

-- Create RLS policies for service_work_order_comments
CREATE POLICY "Users can view service work order comments" ON service_work_order_comments
  FOR SELECT USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can create service work order comments" ON service_work_order_comments
  FOR INSERT WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role) AND auth.uid() = user_id);

CREATE POLICY "Users can delete their own service work order comments" ON service_work_order_comments
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access service work order comments" ON service_work_order_comments
  FOR ALL USING (true) WITH CHECK (true);

-- Create RLS policies for shipping_order_comments
CREATE POLICY "Users can view shipping order comments" ON shipping_order_comments
  FOR SELECT USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can create shipping order comments" ON shipping_order_comments
  FOR INSERT WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role) AND auth.uid() = user_id);

CREATE POLICY "Users can delete their own shipping order comments" ON shipping_order_comments
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access shipping order comments" ON shipping_order_comments
  FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_work_order_comments_work_order_id ON work_order_comments(work_order_id);
CREATE INDEX IF NOT EXISTS idx_service_work_order_comments_service_work_order_id ON service_work_order_comments(service_work_order_id);
CREATE INDEX IF NOT EXISTS idx_shipping_order_comments_shipping_order_id ON shipping_order_comments(shipping_order_id);