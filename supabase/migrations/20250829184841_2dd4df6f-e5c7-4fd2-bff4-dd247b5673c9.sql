-- Creiamo una sequenza per i codici clienti
CREATE SEQUENCE IF NOT EXISTS customer_code_sequence START 1;

-- Funzione per generare il codice cliente
CREATE OR REPLACE FUNCTION public.generate_customer_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    RETURN '33-' || LPAD(NEXTVAL('customer_code_sequence')::TEXT, 4, '0');
END;
$function$;

-- Trigger per generare automaticamente il codice cliente
CREATE OR REPLACE FUNCTION public.auto_generate_customer_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.code IS NULL OR NEW.code = '' THEN
        NEW.code := generate_customer_code();
    END IF;
    RETURN NEW;
END;
$function$;

-- Creiamo il trigger
DROP TRIGGER IF EXISTS auto_customer_code_trigger ON customers;
CREATE TRIGGER auto_customer_code_trigger
    BEFORE INSERT ON customers
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_customer_code();