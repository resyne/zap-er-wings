-- Add supplier management fields
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS contact_name TEXT,
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS access_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS last_access_at TIMESTAMPTZ;

-- Generate random access codes for existing suppliers
UPDATE suppliers 
SET access_code = upper(substring(md5(random()::text) from 1 for 8))
WHERE access_code IS NULL;

-- Make access_code required for new suppliers
ALTER TABLE suppliers 
ALTER COLUMN access_code SET NOT NULL;

-- Add status tracking to purchase orders
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS supplier_confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS supplier_confirmed_by TEXT,
ADD COLUMN IF NOT EXISTS estimated_delivery_date DATE,
ADD COLUMN IF NOT EXISTS actual_delivery_date DATE,
ADD COLUMN IF NOT EXISTS production_status TEXT DEFAULT 'pending' CHECK (production_status IN ('pending', 'confirmed', 'in_production', 'shipped', 'delivered', 'cancelled')),
ADD COLUMN IF NOT EXISTS tracking_number TEXT;

-- Create purchase order comments table
CREATE TABLE IF NOT EXISTS purchase_order_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  is_supplier BOOLEAN DEFAULT false,
  supplier_name TEXT,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create purchase order attachments table
CREATE TABLE IF NOT EXISTS purchase_order_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  uploaded_by_supplier BOOLEAN DEFAULT false,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create purchase order status updates table
CREATE TABLE IF NOT EXISTS purchase_order_status_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  estimated_delivery_date DATE,
  notes TEXT,
  updated_by_supplier BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create purchase order change requests table (for supplier proposed modifications)
CREATE TABLE IF NOT EXISTS purchase_order_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('quantity', 'price', 'specifications', 'delivery_date', 'other')),
  current_value TEXT,
  proposed_value TEXT NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE purchase_order_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_status_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_change_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for internal users (authenticated)
CREATE POLICY "Internal users can view all comments"
  ON purchase_order_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Internal users can create comments"
  ON purchase_order_comments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_supplier = false);

CREATE POLICY "Internal users can view all attachments"
  ON purchase_order_attachments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Internal users can upload attachments"
  ON purchase_order_attachments FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by_supplier = false);

CREATE POLICY "Internal users can view all status updates"
  ON purchase_order_status_updates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Internal users can view all change requests"
  ON purchase_order_change_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Internal users can review change requests"
  ON purchase_order_change_requests FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (reviewed_by = auth.uid());

-- RLS Policies for public access (suppliers with valid access code)
-- Note: These will be enforced by the edge function that validates the access code
CREATE POLICY "Public can view comments for their orders"
  ON purchase_order_comments FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public can create supplier comments"
  ON purchase_order_comments FOR INSERT
  TO anon
  WITH CHECK (is_supplier = true);

CREATE POLICY "Public can view attachments for their orders"
  ON purchase_order_attachments FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public can upload supplier attachments"
  ON purchase_order_attachments FOR INSERT
  TO anon
  WITH CHECK (uploaded_by_supplier = true);

CREATE POLICY "Public can view status updates for their orders"
  ON purchase_order_status_updates FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public can create supplier status updates"
  ON purchase_order_status_updates FOR INSERT
  TO anon
  WITH CHECK (updated_by_supplier = true);

CREATE POLICY "Public can view change requests for their orders"
  ON purchase_order_change_requests FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public can create change requests"
  ON purchase_order_change_requests FOR INSERT
  TO anon
  WITH CHECK (true);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_po_comments_order ON purchase_order_comments(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_attachments_order ON purchase_order_attachments(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_updates_order ON purchase_order_status_updates(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_changes_order ON purchase_order_change_requests(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_access_code ON suppliers(access_code);

-- Function to update last_access_at for suppliers
CREATE OR REPLACE FUNCTION update_supplier_last_access()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE suppliers 
  SET last_access_at = now()
  WHERE id = NEW.supplier_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;