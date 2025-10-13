-- Rimuovi il vecchio check constraint sullo status
ALTER TABLE sales_orders DROP CONSTRAINT IF EXISTS sales_orders_status_check;

-- Aggiungi il nuovo check constraint con i nuovi stati
ALTER TABLE sales_orders ADD CONSTRAINT sales_orders_status_check 
  CHECK (status IN ('commissionato', 'in_lavorazione', 'completato', 'draft', 'pending', 'processing', 'in_progress', 'completed', 'delivered', 'shipped'));

-- Aggiorna gli ordini esistenti con stati vecchi a quelli nuovi
UPDATE sales_orders 
SET status = CASE 
  WHEN status IN ('draft', 'pending') THEN 'commissionato'
  WHEN status IN ('processing', 'in_progress') THEN 'in_lavorazione'
  WHEN status IN ('completed', 'delivered', 'shipped') THEN 'completato'
  ELSE status
END
WHERE status NOT IN ('commissionato', 'in_lavorazione', 'completato');

-- Funzione per aggiornare lo stato del sales_order basandosi sui sotto-ordini
CREATE OR REPLACE FUNCTION update_sales_order_status_from_sub_orders()
RETURNS TRIGGER AS $$
DECLARE
  v_sales_order_id UUID;
  v_all_completed BOOLEAN;
  v_any_in_progress BOOLEAN;
  v_new_status TEXT;
BEGIN
  -- Ottieni il sales_order_id dal trigger
  IF TG_TABLE_NAME = 'work_orders' THEN
    v_sales_order_id := NEW.sales_order_id;
  ELSIF TG_TABLE_NAME = 'service_work_orders' THEN
    v_sales_order_id := NEW.sales_order_id;
  ELSIF TG_TABLE_NAME = 'shipping_orders' THEN
    v_sales_order_id := NEW.sales_order_id;
  END IF;

  -- Se non c'è un sales_order_id, esci
  IF v_sales_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Controlla se tutti i sotto-ordini sono completati
  SELECT 
    COALESCE(
      (SELECT COUNT(*) = 0 OR bool_and(status IN ('completed', 'completato'))
       FROM work_orders 
       WHERE sales_order_id = v_sales_order_id), 
      true
    ) AND
    COALESCE(
      (SELECT COUNT(*) = 0 OR bool_and(status IN ('completed', 'completato'))
       FROM service_work_orders 
       WHERE sales_order_id = v_sales_order_id), 
      true
    ) AND
    COALESCE(
      (SELECT COUNT(*) = 0 OR bool_and(status IN ('spedito', 'completed'))
       FROM shipping_orders 
       WHERE sales_order_id = v_sales_order_id), 
      true
    )
  INTO v_all_completed;

  -- Controlla se almeno un sotto-ordine è in lavorazione
  SELECT 
    COALESCE(
      (SELECT bool_or(status IN ('in_progress', 'in_lavorazione', 'in_corso'))
       FROM work_orders 
       WHERE sales_order_id = v_sales_order_id), 
      false
    ) OR
    COALESCE(
      (SELECT bool_or(status IN ('in_progress', 'in_lavorazione', 'in_corso'))
       FROM service_work_orders 
       WHERE sales_order_id = v_sales_order_id), 
      false
    ) OR
    COALESCE(
      (SELECT bool_or(status IN ('in_preparazione', 'in_progress'))
       FROM shipping_orders 
       WHERE sales_order_id = v_sales_order_id), 
      false
    )
  INTO v_any_in_progress;

  -- Determina il nuovo stato
  IF v_all_completed THEN
    v_new_status := 'completato';
  ELSIF v_any_in_progress THEN
    v_new_status := 'in_lavorazione';
  ELSE
    -- Non cambiare lo stato se nessun sotto-ordine è in progress o completato
    RETURN NEW;
  END IF;

  -- Aggiorna lo stato del sales order
  UPDATE sales_orders 
  SET status = v_new_status,
      updated_at = now()
  WHERE id = v_sales_order_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crea i trigger per aggiornare automaticamente lo stato
DROP TRIGGER IF EXISTS update_sales_order_from_work_order ON work_orders;
CREATE TRIGGER update_sales_order_from_work_order
  AFTER INSERT OR UPDATE OF status ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_order_status_from_sub_orders();

DROP TRIGGER IF EXISTS update_sales_order_from_service_work_order ON service_work_orders;
CREATE TRIGGER update_sales_order_from_service_work_order
  AFTER INSERT OR UPDATE OF status ON service_work_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_order_status_from_sub_orders();

DROP TRIGGER IF EXISTS update_sales_order_from_shipping_order ON shipping_orders;
CREATE TRIGGER update_sales_order_from_shipping_order
  AFTER INSERT OR UPDATE OF status ON shipping_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_sales_order_status_from_sub_orders();