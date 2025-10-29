-- Rimuovi il vincolo esistente
ALTER TABLE work_orders 
DROP CONSTRAINT IF EXISTS work_orders_sales_order_id_fkey;

-- Aggiungi il nuovo vincolo con ON DELETE SET NULL
ALTER TABLE work_orders
ADD CONSTRAINT work_orders_sales_order_id_fkey 
FOREIGN KEY (sales_order_id) 
REFERENCES sales_orders(id) 
ON DELETE SET NULL;