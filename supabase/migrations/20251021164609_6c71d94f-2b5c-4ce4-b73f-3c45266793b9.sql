-- Aggiorna le funzioni di generazione numeri per includere il numero ordine

-- Funzione per generare numero commessa di produzione
CREATE OR REPLACE FUNCTION public.generate_production_work_order_number(sales_order_number TEXT DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF sales_order_number IS NOT NULL THEN
        RETURN sales_order_number || '-produzione-' || LPAD(NEXTVAL('production_work_order_sequence')::TEXT, 4, '0');
    ELSE
        RETURN 'CdP-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('production_work_order_sequence')::TEXT, 4, '0');
    END IF;
END;
$function$;

-- Funzione per generare numero commessa di lavoro (servizio)
CREATE OR REPLACE FUNCTION public.generate_service_work_order_number(sales_order_number TEXT DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF sales_order_number IS NOT NULL THEN
        RETURN sales_order_number || '-lavoro-' || LPAD(NEXTVAL('service_work_order_sequence')::TEXT, 4, '0');
    ELSE
        RETURN 'CdL-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('service_work_order_sequence')::TEXT, 4, '0');
    END IF;
END;
$function$;

-- Funzione per generare numero commessa di spedizione
CREATE OR REPLACE FUNCTION public.generate_shipping_order_number(sales_order_number TEXT DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF sales_order_number IS NOT NULL THEN
        RETURN sales_order_number || '-spedizione-' || LPAD(NEXTVAL('shipping_order_sequence')::TEXT, 4, '0');
    ELSE
        RETURN 'CdS-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('shipping_order_sequence')::TEXT, 4, '0');
    END IF;
END;
$function$;

-- Aggiorna i trigger per passare il numero ordine alle funzioni
CREATE OR REPLACE FUNCTION public.auto_generate_production_work_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    sales_order_num TEXT;
BEGIN
    IF NEW.number IS NULL OR NEW.number = '' THEN
        -- Ottieni il numero ordine se esiste sales_order_id
        IF NEW.sales_order_id IS NOT NULL THEN
            SELECT number INTO sales_order_num FROM sales_orders WHERE id = NEW.sales_order_id;
        END IF;
        
        IF NEW.includes_installation = true THEN
            NEW.number := generate_production_installation_work_order_number();
        ELSE
            NEW.number := generate_production_work_order_number(sales_order_num);
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_generate_service_work_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    sales_order_num TEXT;
BEGIN
    IF NEW.number IS NULL OR NEW.number = '' THEN
        -- Ottieni il numero ordine se esiste sales_order_id
        IF NEW.sales_order_id IS NOT NULL THEN
            SELECT number INTO sales_order_num FROM sales_orders WHERE id = NEW.sales_order_id;
        END IF;
        
        NEW.number := generate_service_work_order_number(sales_order_num);
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_generate_shipping_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    sales_order_num TEXT;
BEGIN
    IF NEW.number IS NULL OR NEW.number = '' THEN
        -- Ottieni il numero ordine se esiste sales_order_id
        IF NEW.sales_order_id IS NOT NULL THEN
            SELECT number INTO sales_order_num FROM sales_orders WHERE id = NEW.sales_order_id;
        END IF;
        
        NEW.number := generate_shipping_order_number(sales_order_num);
    END IF;
    RETURN NEW;
END;
$function$;