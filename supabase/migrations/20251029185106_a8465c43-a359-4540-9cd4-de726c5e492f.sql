-- Function to populate missing shipping order items from sales orders
CREATE OR REPLACE FUNCTION populate_missing_shipping_order_items()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  shipping_order RECORD;
  items_added INTEGER := 0;
  row_count INTEGER;
BEGIN
  -- Per ogni ordine di spedizione senza articoli ma con sales_order_id
  FOR shipping_order IN 
    SELECT so.id, so.sales_order_id
    FROM shipping_orders so
    WHERE so.sales_order_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM shipping_order_items soi 
      WHERE soi.shipping_order_id = so.id
    )
  LOOP
    -- Inserisci gli articoli dal sales_order_items
    INSERT INTO shipping_order_items (
      shipping_order_id,
      material_id,
      product_name,
      quantity,
      unit_price,
      total_price,
      notes
    )
    SELECT 
      shipping_order.id,
      p.material_id,
      soi.product_name,
      soi.quantity,
      soi.unit_price,
      soi.quantity * soi.unit_price,
      soi.description
    FROM sales_order_items soi
    LEFT JOIN products p ON p.name = soi.product_name
    WHERE soi.sales_order_id = shipping_order.sales_order_id;
    
    GET DIAGNOSTICS row_count = ROW_COUNT;
    items_added := items_added + row_count;
  END LOOP;
  
  RETURN items_added;
END;
$$;

-- Execute the function to populate existing orders
SELECT populate_missing_shipping_order_items() as items_populated;