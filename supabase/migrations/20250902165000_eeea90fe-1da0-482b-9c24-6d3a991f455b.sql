-- Update the generate_sales_order_number function to use OdV prefix
CREATE OR REPLACE FUNCTION public.generate_sales_order_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN 'OdV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('sales_order_sequence')::TEXT, 4, '0');
END;
$function$;