ALTER TABLE service_reports ADD COLUMN IF NOT EXISTS sales_order_id uuid REFERENCES sales_orders(id);
ALTER TABLE ddts ADD COLUMN IF NOT EXISTS sales_order_id uuid REFERENCES sales_orders(id);