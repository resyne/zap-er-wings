-- Aggiorna la nomenclatura dei codici commesse da CdP/CdL/CdS a OdP/OdL/OdS

-- Funzione per generare numero commessa di produzione (OdP)
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
        RETURN 'OdP-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('production_work_order_sequence')::TEXT, 4, '0');
    END IF;
END;
$function$;

-- Funzione per generare numero commessa di lavoro/servizio (OdL)
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
        RETURN 'OdL-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('service_work_order_sequence')::TEXT, 4, '0');
    END IF;
END;
$function$;

-- Funzione per generare numero commessa di spedizione (OdS)
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
        RETURN 'OdS-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('shipping_order_sequence')::TEXT, 4, '0');
    END IF;
END;
$function$;