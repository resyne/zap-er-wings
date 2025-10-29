-- Check and update foreign key for shipping_orders.customer_id
-- First drop the existing foreign key if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name LIKE '%shipping_orders%customer%'
        AND table_name = 'shipping_orders'
    ) THEN
        EXECUTE (
            SELECT 'ALTER TABLE shipping_orders DROP CONSTRAINT ' || constraint_name
            FROM information_schema.table_constraints
            WHERE constraint_name LIKE '%shipping_orders%customer%'
            AND table_name = 'shipping_orders'
            LIMIT 1
        );
    END IF;
END $$;

-- Add new foreign key pointing to customers table
ALTER TABLE shipping_orders
  ADD CONSTRAINT shipping_orders_customer_id_fkey 
  FOREIGN KEY (customer_id) 
  REFERENCES customers(id) 
  ON DELETE SET NULL;