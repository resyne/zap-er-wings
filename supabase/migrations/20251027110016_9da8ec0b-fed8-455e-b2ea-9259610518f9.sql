-- Aggiorna la funzione per considerare le commesse completate come "in lavorazione"
-- finché non sono TUTTE completate
CREATE OR REPLACE FUNCTION public.update_sales_order_status_from_sub_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sales_order_id UUID;
  v_all_completed BOOLEAN;
  v_any_started BOOLEAN;
  v_has_orders BOOLEAN;
  v_new_status TEXT;
BEGIN
  -- Ottieni il sales_order_id dal trigger
  IF TG_TABLE_NAME = 'work_orders' THEN
    v_sales_order_id := COALESCE(NEW.sales_order_id, OLD.sales_order_id);
  ELSIF TG_TABLE_NAME = 'service_work_orders' THEN
    v_sales_order_id := COALESCE(NEW.sales_order_id, OLD.sales_order_id);
  ELSIF TG_TABLE_NAME = 'shipping_orders' THEN
    v_sales_order_id := COALESCE(NEW.sales_order_id, OLD.sales_order_id);
  END IF;

  -- Se non c'è un sales_order_id, esci
  IF v_sales_order_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Verifica se ci sono commesse collegate
  SELECT EXISTS (
    SELECT 1 FROM work_orders WHERE sales_order_id = v_sales_order_id
    UNION ALL
    SELECT 1 FROM service_work_orders WHERE sales_order_id = v_sales_order_id
    UNION ALL
    SELECT 1 FROM shipping_orders WHERE sales_order_id = v_sales_order_id
  ) INTO v_has_orders;

  -- Se non ci sono commesse, non fare nulla
  IF NOT v_has_orders THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Controlla se TUTTE le commesse sono completate
  -- Stati completati: work_orders.completato, shipping_orders.spedito
  -- service_work_orders non ha uno stato completato esplicito, quindi consideriamo 'completato' se esiste
  WITH all_orders AS (
    SELECT status::text as status FROM work_orders WHERE sales_order_id = v_sales_order_id
    UNION ALL
    SELECT status::text FROM service_work_orders WHERE sales_order_id = v_sales_order_id
    UNION ALL
    SELECT status::text FROM shipping_orders WHERE sales_order_id = v_sales_order_id
  )
  SELECT 
    COUNT(*) > 0 AND 
    bool_and(
      status IN ('completato', 'spedito')
    )
  INTO v_all_completed
  FROM all_orders;

  -- Controlla se ALMENO UNA commessa è iniziata (non è più in planned o da_fare)
  -- Stati iniziati: qualsiasi cosa diversa da 'planned' o 'da_fare'
  WITH all_orders AS (
    SELECT status::text as status FROM work_orders WHERE sales_order_id = v_sales_order_id
    UNION ALL
    SELECT status::text FROM service_work_orders WHERE sales_order_id = v_sales_order_id
    UNION ALL
    SELECT status::text FROM shipping_orders WHERE sales_order_id = v_sales_order_id
  )
  SELECT 
    bool_or(
      status NOT IN ('planned', 'da_fare')
    )
  INTO v_any_started
  FROM all_orders;

  -- Determina il nuovo stato
  IF v_all_completed THEN
    v_new_status := 'completato';
  ELSIF v_any_started THEN
    v_new_status := 'in_lavorazione';
  ELSE
    -- Se tutte sono in planned o da_fare, mantieni lo stato attuale dell'ordine
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Aggiorna lo stato del sales order solo se è cambiato
  UPDATE sales_orders 
  SET status = v_new_status,
      updated_at = now()
  WHERE id = v_sales_order_id 
    AND status IS DISTINCT FROM v_new_status;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Forza un aggiornamento degli stati esistenti
-- Triggera la funzione su tutti gli ordini con commesse
UPDATE work_orders SET updated_at = updated_at WHERE sales_order_id IS NOT NULL;
UPDATE service_work_orders SET updated_at = updated_at WHERE sales_order_id IS NOT NULL;
UPDATE shipping_orders SET updated_at = updated_at WHERE sales_order_id IS NOT NULL;