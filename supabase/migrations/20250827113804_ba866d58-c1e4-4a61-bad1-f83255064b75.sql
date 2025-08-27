-- Aggiorna le funzioni per risolvere i warning di sicurezza
CREATE OR REPLACE FUNCTION generate_sales_order_number()
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    RETURN 'SO-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('sales_order_sequence')::TEXT, 4, '0');
END;
$$;

-- Aggiorna il trigger function con security definer
CREATE OR REPLACE FUNCTION auto_generate_sales_order_number()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF NEW.number IS NULL OR NEW.number = '' THEN
        NEW.number := generate_sales_order_number();
    END IF;
    RETURN NEW;
END;
$$;