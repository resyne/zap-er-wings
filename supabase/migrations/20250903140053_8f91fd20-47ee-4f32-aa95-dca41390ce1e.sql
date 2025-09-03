-- Funzione per aggiornare automaticamente lo stato degli ordini di vendita
-- basato sullo stato degli ordini di produzione
CREATE OR REPLACE FUNCTION public.update_sales_order_status_from_work_order()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo se c'è un sales_order_id collegato
    IF NEW.sales_order_id IS NOT NULL THEN
        -- Se l'ordine di produzione passa da planned a in_progress o completato
        -- allora l'ordine di vendita passa in progress
        IF OLD.status = 'planned' AND NEW.status IN ('in_progress', 'completed') THEN
            UPDATE sales_orders 
            SET status = 'in_progress', updated_at = now()
            WHERE id = NEW.sales_order_id AND status = 'draft';
        
        -- Se l'ordine di produzione è completato, l'ordine di vendita passa in completed
        ELSIF NEW.status = 'completed' AND OLD.status != 'completed' THEN
            UPDATE sales_orders 
            SET status = 'completed', updated_at = now()
            WHERE id = NEW.sales_order_id;
        
        -- Se l'ordine di produzione torna in uno stato precedente, 
        -- aggiorna di conseguenza l'ordine di vendita
        ELSIF OLD.status = 'completed' AND NEW.status != 'completed' THEN
            UPDATE sales_orders 
            SET status = 'in_progress', updated_at = now()
            WHERE id = NEW.sales_order_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Crea il trigger per aggiornare automaticamente gli ordini di vendita
-- quando cambia lo stato degli ordini di produzione
CREATE TRIGGER update_sales_order_status_trigger
    AFTER UPDATE OF status ON work_orders
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.update_sales_order_status_from_work_order();