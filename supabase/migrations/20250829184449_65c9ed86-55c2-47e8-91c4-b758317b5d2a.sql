-- Prima rimuoviamo i riferimenti dalle tabelle collegate
DELETE FROM serials WHERE work_order_id IS NOT NULL;

-- Ora possiamo rimuovere gli ordini di produzione
DELETE FROM work_orders;

-- Aggiorniamo la funzione per generare numeri OdP
CREATE OR REPLACE FUNCTION public.generate_production_work_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    RETURN 'OdP-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('production_work_order_sequence')::TEXT, 4, '0');
END;
$function$;

-- Funzione per generare numeri OdPeL (produzione + installazione)
CREATE OR REPLACE FUNCTION public.generate_production_installation_work_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    RETURN 'OdPeL-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('production_work_order_sequence')::TEXT, 4, '0');
END;
$function$;

-- Aggiungiamo una colonna per indicare se include installazione
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS includes_installation boolean DEFAULT false;

-- Aggiorniamo il trigger per usare la numerazione corretta
CREATE OR REPLACE FUNCTION public.auto_generate_production_work_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.number IS NULL OR NEW.number = '' THEN
        IF NEW.includes_installation = true THEN
            NEW.number := generate_production_installation_work_order_number();
        ELSE
            NEW.number := generate_production_work_order_number();
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

-- Reset della sequenza per iniziare da 1
ALTER SEQUENCE production_work_order_sequence RESTART WITH 1;