-- Aggiungi il collegamento ai lead nella tabella offers
ALTER TABLE public.offers 
ADD COLUMN lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

-- Crea un indice per migliorare le performance
CREATE INDEX idx_offers_lead_id ON public.offers(lead_id);

-- Crea la funzione per creare automaticamente un lead quando viene creata un'offerta
CREATE OR REPLACE FUNCTION public.create_lead_from_offer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    customer_data RECORD;
    new_lead_id uuid;
BEGIN
    -- Se non c'è già un lead_id associato e c'è un customer_id
    IF NEW.lead_id IS NULL AND NEW.customer_id IS NOT NULL THEN
        -- Ottieni i dati del cliente
        SELECT * INTO customer_data 
        FROM public.customers 
        WHERE id = NEW.customer_id;
        
        IF customer_data IS NOT NULL THEN
            -- Crea il lead
            INSERT INTO public.leads (
                company_name,
                contact_name,
                email,
                phone,
                status,
                pipeline,
                value,
                notes
            ) VALUES (
                COALESCE(customer_data.company_name, customer_data.name),
                customer_data.name,
                customer_data.email,
                customer_data.phone,
                'qualified', -- Lo stato iniziale del lead
                'ZAPPER', -- Pipeline di default
                NEW.amount,
                'Lead creato automaticamente dall''offerta: ' || NEW.title
            )
            RETURNING id INTO new_lead_id;
            
            -- Aggiorna l'offerta con il lead_id appena creato
            NEW.lead_id := new_lead_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Crea il trigger per creare automaticamente un lead
CREATE TRIGGER trigger_create_lead_from_offer
    BEFORE INSERT ON public.offers
    FOR EACH ROW
    EXECUTE FUNCTION public.create_lead_from_offer();