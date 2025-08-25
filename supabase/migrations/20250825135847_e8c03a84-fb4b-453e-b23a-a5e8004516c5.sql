-- Aggiungi campi aziendali alla tabella crm_contacts
ALTER TABLE public.crm_contacts 
ADD COLUMN company_name TEXT,
ADD COLUMN piva TEXT,
ADD COLUMN address TEXT,
ADD COLUMN sdi_code TEXT,
ADD COLUMN pec TEXT;

-- Aggiungi campi descrizione e attachment_urls alla tabella crm_deals per le foto
ALTER TABLE public.crm_deals 
ADD COLUMN description TEXT,
ADD COLUMN attachment_urls TEXT[];

-- Crea trigger per generare automaticamente ordini di produzione quando un'opportunità viene vinta
CREATE OR REPLACE FUNCTION public.create_work_order_from_opportunity()
RETURNS TRIGGER AS $$
DECLARE
    contact_info RECORD;
    company_info RECORD;
    wo_number TEXT;
BEGIN
    -- Solo se l'opportunità è stata chiusa come vinta
    IF NEW.stage = 'chiusa' AND (OLD.stage IS NULL OR OLD.stage != 'chiusa') THEN
        -- Genera numero ordine di produzione
        wo_number := 'WO-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('work_order_sequence')::TEXT, 4, '0');
        
        -- Ottieni informazioni del contatto
        SELECT * INTO contact_info 
        FROM crm_contacts 
        WHERE id = NEW.contact_id;
        
        -- Ottieni informazioni dell'azienda
        SELECT * INTO company_info 
        FROM crm_companies 
        WHERE id = NEW.company_id;
        
        -- Crea l'ordine di produzione
        INSERT INTO work_orders (
            number,
            title,
            description,
            status,
            customer_id,
            created_at,
            updated_at,
            notes
        ) VALUES (
            wo_number,
            'OP da opportunità: ' || NEW.name,
            COALESCE(NEW.description, 'Ordine di produzione generato automaticamente dall''opportunità ' || NEW.name),
            'planned',
            NEW.company_id,
            NOW(),
            NOW(),
            'Cliente: ' || 
            COALESCE(contact_info.first_name || ' ' || contact_info.last_name, 'N/A') || 
            CASE 
                WHEN contact_info.company_name IS NOT NULL THEN ' - ' || contact_info.company_name 
                WHEN company_info.name IS NOT NULL THEN ' - ' || company_info.name
                ELSE ''
            END ||
            CASE 
                WHEN contact_info.piva IS NOT NULL THEN ' (P.IVA: ' || contact_info.piva || ')'
                ELSE ''
            END ||
            CASE 
                WHEN contact_info.address IS NOT NULL THEN E'\nIndirizzo: ' || contact_info.address
                ELSE ''
            END
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crea sequenza per numerazione ordini di produzione
CREATE SEQUENCE IF NOT EXISTS work_order_sequence START 1;

-- Crea trigger per l'aggiornamento delle opportunità
CREATE TRIGGER trigger_create_work_order_from_opportunity
    AFTER UPDATE ON public.crm_deals
    FOR EACH ROW
    EXECUTE FUNCTION public.create_work_order_from_opportunity();