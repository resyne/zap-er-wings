-- Trigger function to auto-complete sales_orders when all linked commesse are completed
CREATE OR REPLACE FUNCTION public.auto_complete_sales_order_from_commesse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sales_order_id UUID;
  v_total_commesse INTEGER;
  v_completed_commesse INTEGER;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_sales_order_id := NEW.sales_order_id;
  
  IF v_sales_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('completata', 'archiviata'))
  INTO v_total_commesse, v_completed_commesse
  FROM public.commesse
  WHERE sales_order_id = v_sales_order_id;

  IF v_total_commesse > 0 AND v_total_commesse = v_completed_commesse THEN
    UPDATE public.sales_orders
    SET status = 'completato', updated_at = now()
    WHERE id = v_sales_order_id
    AND status != 'completato';
  ELSIF NEW.status NOT IN ('completata', 'archiviata') AND OLD.status IN ('completata', 'archiviata') THEN
    UPDATE public.sales_orders
    SET status = 'in_lavorazione', updated_at = now()
    WHERE id = v_sales_order_id
    AND status = 'completato';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_complete_sales_order ON public.commesse;
CREATE TRIGGER trg_auto_complete_sales_order
  AFTER UPDATE OF status ON public.commesse
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_complete_sales_order_from_commesse();