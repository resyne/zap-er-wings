-- Update production work order number generation function
CREATE OR REPLACE FUNCTION public.generate_production_work_order_number(sales_order_number text DEFAULT NULL::text)
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

-- Update service work order number generation function
CREATE OR REPLACE FUNCTION public.generate_service_work_order_number(sales_order_number text DEFAULT NULL::text)
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

-- Update shipping order number generation function
CREATE OR REPLACE FUNCTION public.generate_shipping_order_number(sales_order_number text DEFAULT NULL::text)
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

-- Update production installation work order number generation function
CREATE OR REPLACE FUNCTION public.generate_production_installation_work_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    RETURN 'CdP+L-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('production_work_order_sequence')::TEXT, 4, '0');
END;
$function$;