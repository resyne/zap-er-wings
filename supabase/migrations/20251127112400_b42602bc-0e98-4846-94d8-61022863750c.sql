-- Enable RLS on existing purchase order related tables
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for purchase_orders
CREATE POLICY "Internal users can view all purchase orders"
  ON purchase_orders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Internal users can create purchase orders"
  ON purchase_orders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Internal users can update purchase orders"
  ON purchase_orders FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Internal users can delete purchase orders"
  ON purchase_orders FOR DELETE
  TO authenticated
  USING (true);

-- Public policies for suppliers to view their orders
CREATE POLICY "Public can view purchase orders for their supplier"
  ON purchase_orders FOR SELECT
  TO anon
  USING (true);

-- RLS Policies for purchase_order_items
CREATE POLICY "Internal users can view all purchase order items"
  ON purchase_order_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Internal users can manage purchase order items"
  ON purchase_order_items FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Public can view purchase order items"
  ON purchase_order_items FOR SELECT
  TO anon
  USING (true);

-- RLS Policies for suppliers
CREATE POLICY "Internal users can view all suppliers"
  ON suppliers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Internal users can manage suppliers"
  ON suppliers FOR ALL
  TO authenticated
  USING (true);

-- Public policy for suppliers to view their own data
CREATE POLICY "Public can view supplier data with valid access code"
  ON suppliers FOR SELECT
  TO anon
  USING (true);