-- Create enums for production workflows
CREATE TYPE wo_status AS ENUM ('planned', 'in_progress', 'testing', 'closed');
CREATE TYPE serial_status AS ENUM ('in_test', 'approved', 'rejected');
CREATE TYPE rma_status AS ENUM ('open', 'analysis', 'repaired', 'closed');

-- BOMs table (Bill of Materials)
CREATE TABLE public.boms (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE(name, version)
);

-- BOM Items (components in a BOM)
CREATE TABLE public.bom_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    bom_id UUID NOT NULL REFERENCES public.boms(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id),
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(bom_id, item_id)
);

-- Work Orders (Production Orders)
CREATE TABLE public.work_orders (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    number TEXT NOT NULL UNIQUE,
    bom_id UUID REFERENCES public.boms(id),
    status wo_status NOT NULL DEFAULT 'planned',
    planned_start_date TIMESTAMP WITH TIME ZONE,
    planned_end_date TIMESTAMP WITH TIME ZONE,
    actual_start_date TIMESTAMP WITH TIME ZONE,
    actual_end_date TIMESTAMP WITH TIME ZONE,
    assigned_to UUID REFERENCES auth.users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Executions (production phases/steps tracking)
CREATE TABLE public.executions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    operator_id UUID REFERENCES auth.users(id),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    end_time TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CHECK (end_time IS NULL OR end_time > start_time)
);

-- Serials (serialized units with testing)
CREATE TABLE public.serials (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    serial_number TEXT NOT NULL UNIQUE,
    work_order_id UUID NOT NULL REFERENCES public.work_orders(id),
    status serial_status NOT NULL DEFAULT 'in_test',
    test_result TEXT,
    test_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RMA (Return Merchandise Authorization)
CREATE TABLE public.rma (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    rma_number TEXT NOT NULL UNIQUE,
    customer_id UUID REFERENCES public.customers(id),
    serial_id UUID REFERENCES public.serials(id),
    description TEXT NOT NULL,
    status rma_status NOT NULL DEFAULT 'open',
    assigned_to UUID REFERENCES auth.users(id),
    resolution_notes TEXT,
    opened_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    closed_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Audit Log table
CREATE TABLE public.audit_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    old_values JSONB,
    new_values JSONB,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.boms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.serials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rma ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for authenticated users
CREATE POLICY "Allow authenticated users to view boms" ON public.boms FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to insert boms" ON public.boms FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update boms" ON public.boms FOR UPDATE USING (true);
CREATE POLICY "Allow authenticated users to delete boms" ON public.boms FOR DELETE USING (true);

CREATE POLICY "Allow authenticated users to view bom_items" ON public.bom_items FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to insert bom_items" ON public.bom_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update bom_items" ON public.bom_items FOR UPDATE USING (true);
CREATE POLICY "Allow authenticated users to delete bom_items" ON public.bom_items FOR DELETE USING (true);

CREATE POLICY "Allow authenticated users to view work_orders" ON public.work_orders FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to insert work_orders" ON public.work_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update work_orders" ON public.work_orders FOR UPDATE USING (true);
CREATE POLICY "Allow authenticated users to delete work_orders" ON public.work_orders FOR DELETE USING (true);

CREATE POLICY "Allow authenticated users to view executions" ON public.executions FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to insert executions" ON public.executions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update executions" ON public.executions FOR UPDATE USING (true);
CREATE POLICY "Allow authenticated users to delete executions" ON public.executions FOR DELETE USING (true);

CREATE POLICY "Allow authenticated users to view serials" ON public.serials FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to insert serials" ON public.serials FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update serials" ON public.serials FOR UPDATE USING (true);
CREATE POLICY "Allow authenticated users to delete serials" ON public.serials FOR DELETE USING (true);

CREATE POLICY "Allow authenticated users to view rma" ON public.rma FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to insert rma" ON public.rma FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update rma" ON public.rma FOR UPDATE USING (true);
CREATE POLICY "Allow authenticated users to delete rma" ON public.rma FOR DELETE USING (true);

CREATE POLICY "Allow authenticated users to view audit_logs" ON public.audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to insert audit_logs" ON public.audit_logs FOR INSERT WITH CHECK (true);

-- Triggers for updated_at
CREATE TRIGGER update_boms_updated_at BEFORE UPDATE ON public.boms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_work_orders_updated_at BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_executions_updated_at BEFORE UPDATE ON public.executions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_serials_updated_at BEFORE UPDATE ON public.serials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rma_updated_at BEFORE UPDATE ON public.rma FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_bom_items_bom_id ON public.bom_items(bom_id);
CREATE INDEX idx_bom_items_item_id ON public.bom_items(item_id);
CREATE INDEX idx_work_orders_bom_id ON public.work_orders(bom_id);
CREATE INDEX idx_work_orders_status ON public.work_orders(status);
CREATE INDEX idx_executions_work_order_id ON public.executions(work_order_id);
CREATE INDEX idx_executions_operator_id ON public.executions(operator_id);
CREATE INDEX idx_serials_work_order_id ON public.serials(work_order_id);
CREATE INDEX idx_serials_status ON public.serials(status);
CREATE INDEX idx_rma_customer_id ON public.rma(customer_id);
CREATE INDEX idx_rma_serial_id ON public.rma(serial_id);
CREATE INDEX idx_rma_status ON public.rma(status);
CREATE INDEX idx_audit_logs_table_record ON public.audit_logs(table_name, record_id);

-- Generate sample data
INSERT INTO public.boms (name, version, notes, created_by) VALUES
('Engine Assembly', 'v1.0', 'Main engine assembly with all components', (SELECT id FROM auth.users LIMIT 1)),
('Hydraulic Pump', 'v2.1', 'High pressure hydraulic pump assembly', (SELECT id FROM auth.users LIMIT 1)),
('Control Panel', 'v1.5', 'Electronic control panel with display', (SELECT id FROM auth.users LIMIT 1));

-- BOM Items (assuming we have items from previous migration)
INSERT INTO public.bom_items (bom_id, item_id, quantity) 
SELECT 
    (SELECT id FROM public.boms WHERE name = 'Engine Assembly' LIMIT 1),
    id,
    CASE 
        WHEN ROW_NUMBER() OVER() = 1 THEN 1
        WHEN ROW_NUMBER() OVER() = 2 THEN 2
        WHEN ROW_NUMBER() OVER() = 3 THEN 4
        ELSE 1
    END
FROM public.items LIMIT 4;

INSERT INTO public.bom_items (bom_id, item_id, quantity)
SELECT 
    (SELECT id FROM public.boms WHERE name = 'Hydraulic Pump' LIMIT 1),
    id,
    CASE 
        WHEN ROW_NUMBER() OVER() = 1 THEN 1
        WHEN ROW_NUMBER() OVER() = 2 THEN 3
        ELSE 2
    END
FROM public.items OFFSET 4 LIMIT 3;

-- Work Orders
INSERT INTO public.work_orders (number, bom_id, status, planned_start_date, planned_end_date, assigned_to, notes, created_by) VALUES
('WO-2024-001', (SELECT id FROM public.boms WHERE name = 'Engine Assembly' LIMIT 1), 'planned', now() + INTERVAL '1 day', now() + INTERVAL '5 days', (SELECT id FROM auth.users LIMIT 1), 'Urgent order for customer ABC', (SELECT id FROM auth.users LIMIT 1)),
('WO-2024-002', (SELECT id FROM public.boms WHERE name = 'Hydraulic Pump' LIMIT 1), 'in_progress', now() - INTERVAL '2 days', now() + INTERVAL '3 days', (SELECT id FROM auth.users LIMIT 1), 'Standard production run', (SELECT id FROM auth.users LIMIT 1)),
('WO-2024-003', (SELECT id FROM public.boms WHERE name = 'Control Panel' LIMIT 1), 'testing', now() - INTERVAL '5 days', now() - INTERVAL '1 day', (SELECT id FROM auth.users LIMIT 1), 'Quality control batch', (SELECT id FROM auth.users LIMIT 1)),
('WO-2024-004', (SELECT id FROM public.boms WHERE name = 'Engine Assembly' LIMIT 1), 'closed', now() - INTERVAL '10 days', now() - INTERVAL '7 days', (SELECT id FROM auth.users LIMIT 1), 'Completed order', (SELECT id FROM auth.users LIMIT 1)),
('WO-2024-005', (SELECT id FROM public.boms WHERE name = 'Hydraulic Pump' LIMIT 1), 'planned', now() + INTERVAL '7 days', now() + INTERVAL '14 days', (SELECT id FROM auth.users LIMIT 1), 'Future production planning', (SELECT id FROM auth.users LIMIT 1));

-- Executions
INSERT INTO public.executions (work_order_id, step_name, operator_id, start_time, end_time, notes) VALUES
((SELECT id FROM public.work_orders WHERE number = 'WO-2024-002' LIMIT 1), 'Material Preparation', (SELECT id FROM auth.users LIMIT 1), now() - INTERVAL '2 days', now() - INTERVAL '2 days' + INTERVAL '2 hours', 'Materials ready'),
((SELECT id FROM public.work_orders WHERE number = 'WO-2024-002' LIMIT 1), 'Assembly Phase 1', (SELECT id FROM auth.users LIMIT 1), now() - INTERVAL '1 day', now() - INTERVAL '1 day' + INTERVAL '4 hours', 'Base assembly completed'),
((SELECT id FROM public.work_orders WHERE number = 'WO-2024-002' LIMIT 1), 'Assembly Phase 2', (SELECT id FROM auth.users LIMIT 1), now() - INTERVAL '4 hours', NULL, 'Currently in progress'),
((SELECT id FROM public.work_orders WHERE number = 'WO-2024-003' LIMIT 1), 'Final Assembly', (SELECT id FROM auth.users LIMIT 1), now() - INTERVAL '3 days', now() - INTERVAL '2 days', 'Assembly completed'),
((SELECT id FROM public.work_orders WHERE number = 'WO-2024-003' LIMIT 1), 'Quality Testing', (SELECT id FROM auth.users LIMIT 1), now() - INTERVAL '1 day', NULL, 'Testing in progress'),
((SELECT id FROM public.work_orders WHERE number = 'WO-2024-004' LIMIT 1), 'Complete Production', (SELECT id FROM auth.users LIMIT 1), now() - INTERVAL '10 days', now() - INTERVAL '7 days', 'Full production cycle completed');

-- Serials
INSERT INTO public.serials (serial_number, work_order_id, status, test_result, test_notes) VALUES
('SN-ENG-001', (SELECT id FROM public.work_orders WHERE number = 'WO-2024-003' LIMIT 1), 'approved', 'PASS', 'All tests passed successfully'),
('SN-ENG-002', (SELECT id FROM public.work_orders WHERE number = 'WO-2024-003' LIMIT 1), 'approved', 'PASS', 'Performance within specifications'),
('SN-HYD-001', (SELECT id FROM public.work_orders WHERE number = 'WO-2024-004' LIMIT 1), 'approved', 'PASS', 'Pressure test successful'),
('SN-HYD-002', (SELECT id FROM public.work_orders WHERE number = 'WO-2024-004' LIMIT 1), 'rejected', 'FAIL', 'Pressure leak detected - requires rework'),
('SN-CTL-001', (SELECT id FROM public.work_orders WHERE number = 'WO-2024-002' LIMIT 1), 'in_test', NULL, 'Currently undergoing electrical tests'),
('SN-CTL-002', (SELECT id FROM public.work_orders WHERE number = 'WO-2024-002' LIMIT 1), 'in_test', NULL, 'Waiting for calibration');

-- RMA
INSERT INTO public.rma (rma_number, customer_id, serial_id, description, status, assigned_to, resolution_notes, created_by) VALUES
('RMA-2024-001', (SELECT id FROM public.customers LIMIT 1), (SELECT id FROM public.serials WHERE serial_number = 'SN-ENG-001' LIMIT 1), 'Customer reports unusual noise during operation', 'analysis', (SELECT id FROM auth.users LIMIT 1), 'Initial inspection scheduled', (SELECT id FROM auth.users LIMIT 1)),
('RMA-2024-002', (SELECT id FROM public.customers LIMIT 1 OFFSET 1), (SELECT id FROM public.serials WHERE serial_number = 'SN-HYD-001' LIMIT 1), 'Hydraulic pressure drop after 100 hours', 'repaired', (SELECT id FROM auth.users LIMIT 1), 'Seal replaced, pressure restored', (SELECT id FROM auth.users LIMIT 1)),
('RMA-2024-003', (SELECT id FROM public.customers LIMIT 1), (SELECT id FROM public.serials WHERE serial_number = 'SN-CTL-001' LIMIT 1), 'Display intermittent failure', 'open', (SELECT id FROM auth.users LIMIT 1), NULL, (SELECT id FROM auth.users LIMIT 1));