-- Add order_type column to sales_orders table
ALTER TABLE sales_orders ADD COLUMN order_type TEXT;

-- Add a comment to explain the order types
COMMENT ON COLUMN sales_orders.order_type IS 'Order type: odl (Service Work Order), odp (Production Work Order), odpel (Production + Service Work Order)';

-- Remove financial columns since they are not needed for this workflow
ALTER TABLE sales_orders DROP COLUMN IF EXISTS subtotal;
ALTER TABLE sales_orders DROP COLUMN IF EXISTS tax_amount;
ALTER TABLE sales_orders DROP COLUMN IF EXISTS total_amount;