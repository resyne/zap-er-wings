-- Add work_order_id and sales_order_id to shipping_orders table
ALTER TABLE shipping_orders 
ADD COLUMN work_order_id uuid REFERENCES work_orders(id),
ADD COLUMN sales_order_id uuid REFERENCES sales_orders(id);