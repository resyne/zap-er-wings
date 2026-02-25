
-- Create sequence for commesse numbers
CREATE SEQUENCE IF NOT EXISTS commessa_sequence START WITH 1;

-- Generate commessa number function
CREATE OR REPLACE FUNCTION public.generate_commessa_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    RETURN 'COM-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('commessa_sequence')::TEXT, 4, '0');
END;
$$;

-- Create unified commesse table
CREATE TABLE public.commesse (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    number TEXT NOT NULL DEFAULT '',
    sales_order_id UUID REFERENCES public.sales_orders(id),
    customer_id UUID REFERENCES public.customers(id),
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL, -- fornitura, intervento, ricambi
    delivery_mode TEXT, -- produzione_spedizione, produzione_installazione, ritiro, spedizione (ricambi)
    intervention_type TEXT, -- manutenzione, riparazione (for intervento)
    priority TEXT DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'da_fare', -- da_fare, in_corso, completata, bloccata
    current_phase INTEGER DEFAULT 1,
    article TEXT,
    notes TEXT,
    bom_id UUID REFERENCES public.boms(id),
    lead_id UUID REFERENCES public.leads(id),
    assigned_to UUID,
    back_office_manager UUID,
    production_responsible_id UUID,
    shipping_responsible_id UUID,
    service_responsible_id UUID,
    -- Shipping info
    shipping_address TEXT,
    shipping_city TEXT,
    shipping_country TEXT,
    shipping_province TEXT,
    shipping_postal_code TEXT,
    -- Technical
    diameter TEXT,
    smoke_inlet TEXT,
    -- Payment
    payment_on_delivery BOOLEAN DEFAULT false,
    payment_amount NUMERIC,
    -- Warranty
    is_warranty BOOLEAN DEFAULT false,
    -- Misc
    attachments JSONB DEFAULT '[]'::jsonb,
    archived BOOLEAN DEFAULT false,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- References to old tables for backward compat
    legacy_work_order_id UUID,
    legacy_shipping_order_id UUID,
    legacy_service_order_id UUID
);

-- Create commessa phases table
CREATE TABLE public.commessa_phases (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    commessa_id UUID NOT NULL REFERENCES public.commesse(id) ON DELETE CASCADE,
    phase_type TEXT NOT NULL, -- produzione, spedizione, installazione, manutenzione, riparazione
    phase_order INTEGER NOT NULL, -- 1, 2, etc.
    status TEXT NOT NULL DEFAULT 'da_fare',
    assigned_to UUID,
    scheduled_date TIMESTAMPTZ,
    started_date TIMESTAMPTZ,
    completed_date TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(commessa_id, phase_order)
);

-- Auto-generate commessa number trigger
CREATE OR REPLACE FUNCTION public.auto_generate_commessa_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF NEW.number IS NULL OR NEW.number = '' THEN
        NEW.number := generate_commessa_number();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_generate_commessa_number
    BEFORE INSERT ON public.commesse
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_generate_commessa_number();

-- Updated_at triggers
CREATE TRIGGER trg_commesse_updated_at
    BEFORE UPDATE ON public.commesse
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_commessa_phases_updated_at
    BEFORE UPDATE ON public.commessa_phases
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.commesse ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commessa_phases ENABLE ROW LEVEL SECURITY;

-- RLS policies (allow all for authenticated users, same pattern as work_orders)
CREATE POLICY "Authenticated users can view commesse"
    ON public.commesse FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert commesse"
    ON public.commesse FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update commesse"
    ON public.commesse FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can delete commesse"
    ON public.commesse FOR DELETE
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can view commessa_phases"
    ON public.commessa_phases FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert commessa_phases"
    ON public.commessa_phases FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update commessa_phases"
    ON public.commessa_phases FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can delete commessa_phases"
    ON public.commessa_phases FOR DELETE
    TO authenticated
    USING (true);

-- Indexes
CREATE INDEX idx_commesse_sales_order_id ON public.commesse(sales_order_id);
CREATE INDEX idx_commesse_customer_id ON public.commesse(customer_id);
CREATE INDEX idx_commesse_status ON public.commesse(status);
CREATE INDEX idx_commesse_archived ON public.commesse(archived);
CREATE INDEX idx_commessa_phases_commessa_id ON public.commessa_phases(commessa_id);

-- Function to update commessa status based on phases
CREATE OR REPLACE FUNCTION public.update_commessa_status_from_phases()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    total_phases INTEGER;
    completed_phases INTEGER;
    blocked_phases INTEGER;
    current_phase_record RECORD;
BEGIN
    -- Count phase statuses
    SELECT COUNT(*), 
           COUNT(*) FILTER (WHERE status IN ('completata', 'completato', 'spedito')),
           COUNT(*) FILTER (WHERE status = 'bloccato')
    INTO total_phases, completed_phases, blocked_phases
    FROM public.commessa_phases
    WHERE commessa_id = NEW.commessa_id;

    -- Determine overall status
    IF blocked_phases > 0 THEN
        UPDATE public.commesse SET status = 'bloccata', current_phase = NEW.phase_order WHERE id = NEW.commessa_id;
    ELSIF completed_phases = total_phases THEN
        UPDATE public.commesse SET status = 'completata', current_phase = total_phases WHERE id = NEW.commessa_id;
    ELSIF completed_phases > 0 THEN
        UPDATE public.commesse SET status = 'in_corso', current_phase = completed_phases + 1 WHERE id = NEW.commessa_id;
    ELSE
        -- Check if any phase has started
        IF NEW.status NOT IN ('da_fare', 'da_preparare', 'da_programmare') THEN
            UPDATE public.commesse SET status = 'in_corso', current_phase = NEW.phase_order WHERE id = NEW.commessa_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_commessa_status
    AFTER UPDATE OF status ON public.commessa_phases
    FOR EACH ROW
    EXECUTE FUNCTION public.update_commessa_status_from_phases();

-- Migrate existing data: work_orders → commesse
INSERT INTO public.commesse (
    sales_order_id, customer_id, title, description, type, priority, status,
    article, notes, bom_id, lead_id, assigned_to, back_office_manager,
    production_responsible_id, diameter, smoke_inlet, payment_on_delivery,
    payment_amount, attachments, archived, created_by, created_at, updated_at,
    legacy_work_order_id
)
SELECT 
    wo.sales_order_id, wo.customer_id, 
    COALESCE(wo.title, wo.article, wo.number), wo.description,
    COALESCE(so.order_type_category, 'fornitura'),
    wo.priority,
    CASE 
        WHEN wo.status = 'completato' THEN 'completata'
        WHEN wo.status = 'bloccato' THEN 'bloccata'
        WHEN wo.status IN ('in_lavorazione', 'in_test', 'pronto') THEN 'in_corso'
        ELSE 'da_fare'
    END,
    wo.article, wo.notes, wo.bom_id, wo.lead_id, wo.assigned_to, wo.back_office_manager,
    wo.production_responsible_id, wo.diameter, wo.smoke_inlet, wo.payment_on_delivery,
    wo.payment_amount, wo.attachments, wo.archived, wo.created_by, wo.created_at, wo.updated_at,
    wo.id
FROM public.work_orders wo
LEFT JOIN public.sales_orders so ON wo.sales_order_id = so.id;

-- Create production phase for each migrated work_order commessa
INSERT INTO public.commessa_phases (commessa_id, phase_type, phase_order, status, assigned_to, scheduled_date, started_date, completed_date)
SELECT 
    c.id, 'produzione', 1, 
    wo.status::text,
    wo.assigned_to, wo.scheduled_date, wo.actual_start_date, wo.actual_end_date
FROM public.commesse c
JOIN public.work_orders wo ON c.legacy_work_order_id = wo.id;

-- For work_orders that have linked shipping_orders, add shipping phase + update delivery_mode
WITH linked_shipping AS (
    SELECT so.*, c.id as commessa_id
    FROM public.shipping_orders so
    JOIN public.commesse c ON c.legacy_work_order_id = so.work_order_id
    WHERE so.work_order_id IS NOT NULL
)
INSERT INTO public.commessa_phases (commessa_id, phase_type, phase_order, status, assigned_to, scheduled_date, completed_date)
SELECT 
    ls.commessa_id, 'spedizione', 2,
    ls.status, ls.assigned_to, ls.order_date::timestamptz, ls.shipped_date
FROM linked_shipping ls;

-- Update commesse with shipping info from linked shipping orders
UPDATE public.commesse c
SET 
    delivery_mode = 'produzione_spedizione',
    shipping_address = so.shipping_address,
    shipping_city = so.shipping_city,
    shipping_country = so.shipping_country,
    shipping_province = so.shipping_province,
    shipping_postal_code = so.shipping_postal_code,
    legacy_shipping_order_id = so.id
FROM public.shipping_orders so
WHERE c.legacy_work_order_id = so.work_order_id AND so.work_order_id IS NOT NULL;

-- For work_orders that have linked service_work_orders (installation), add installation phase
WITH linked_service AS (
    SELECT swo.*, c.id as commessa_id
    FROM public.service_work_orders swo
    JOIN public.commesse c ON c.legacy_work_order_id = swo.production_work_order_id
    WHERE swo.production_work_order_id IS NOT NULL
)
INSERT INTO public.commessa_phases (commessa_id, phase_type, phase_order, status, assigned_to, scheduled_date, started_date, completed_date)
SELECT 
    ls.commessa_id, 'installazione', 2,
    ls.status, ls.assigned_to, ls.scheduled_date, ls.actual_start_date, ls.actual_end_date
FROM linked_service ls;

-- Update delivery_mode for those with installation
UPDATE public.commesse c
SET 
    delivery_mode = 'produzione_installazione',
    legacy_service_order_id = swo.id
FROM public.service_work_orders swo
WHERE c.legacy_work_order_id = swo.production_work_order_id AND swo.production_work_order_id IS NOT NULL;

-- Migrate standalone service_work_orders (intervento) that are NOT linked to a production WO
INSERT INTO public.commesse (
    sales_order_id, customer_id, title, description, type, priority, status,
    article, notes, lead_id, assigned_to, back_office_manager,
    service_responsible_id, archived, created_by, created_at, updated_at,
    legacy_service_order_id, intervention_type
)
SELECT 
    swo.sales_order_id, swo.customer_id,
    COALESCE(swo.title, swo.article, swo.number), swo.description,
    'intervento',
    swo.priority,
    CASE 
        WHEN swo.status IN ('completata', 'completato') THEN 'completata'
        WHEN swo.status = 'bloccato' THEN 'bloccata'
        WHEN swo.status IN ('in_lavorazione', 'in_progress', 'in_corso') THEN 'in_corso'
        ELSE 'da_fare'
    END,
    swo.article, swo.notes, swo.lead_id, swo.assigned_to, swo.back_office_manager,
    swo.service_responsible_id, swo.archived, swo.created_by, swo.created_at, swo.updated_at,
    swo.id, 'manutenzione'
FROM public.service_work_orders swo
WHERE swo.production_work_order_id IS NULL;

-- Create single phase for standalone service work orders
INSERT INTO public.commessa_phases (commessa_id, phase_type, phase_order, status, assigned_to, scheduled_date, started_date, completed_date)
SELECT 
    c.id, 'manutenzione', 1,
    swo.status, swo.assigned_to, swo.scheduled_date, swo.actual_start_date, swo.actual_end_date
FROM public.commesse c
JOIN public.service_work_orders swo ON c.legacy_service_order_id = swo.id
WHERE c.type = 'intervento';

-- Migrate standalone shipping_orders (ricambi) that are NOT linked to a work_order
INSERT INTO public.commesse (
    sales_order_id, customer_id, title, description, type, delivery_mode, status,
    article, notes, shipping_address, shipping_city, shipping_country,
    shipping_province, shipping_postal_code, payment_on_delivery, payment_amount,
    archived, created_by, created_at, updated_at, legacy_shipping_order_id
)
SELECT 
    so.sales_order_id, so.customer_id,
    COALESCE(so.article, so.number), so.notes,
    'ricambi', 'spedizione',
    CASE 
        WHEN so.status = 'spedito' THEN 'completata'
        WHEN so.status IN ('in_lavorazione', 'in_preparazione') THEN 'in_corso'
        ELSE 'da_fare'
    END,
    so.article, so.notes, so.shipping_address, so.shipping_city, so.shipping_country,
    so.shipping_province, so.shipping_postal_code, so.payment_on_delivery, so.payment_amount,
    so.archived, so.created_by, so.created_at, so.updated_at, so.id
FROM public.shipping_orders so
WHERE so.work_order_id IS NULL;

-- Create single phase for standalone shipping orders
INSERT INTO public.commessa_phases (commessa_id, phase_type, phase_order, status, assigned_to, scheduled_date, completed_date)
SELECT 
    c.id, 'spedizione', 1,
    so.status, so.assigned_to, so.order_date::timestamptz, so.shipped_date
FROM public.commesse c
JOIN public.shipping_orders so ON c.legacy_shipping_order_id = so.id
WHERE c.type = 'ricambi';

-- Set sequence to start after migrated count
SELECT setval('commessa_sequence', GREATEST((SELECT COUNT(*) FROM public.commesse), 1));
