-- Fix function search path security issue
CREATE OR REPLACE FUNCTION public.create_work_order_from_opportunity()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
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
$$;