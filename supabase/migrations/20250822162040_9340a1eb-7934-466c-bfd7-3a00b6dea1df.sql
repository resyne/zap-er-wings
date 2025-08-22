-- Insert sample data with required title field
INSERT INTO public.boms (name, version, notes, created_by) VALUES
('Engine Assembly', 'v1.0', 'Main engine assembly with all components', (SELECT id FROM auth.users LIMIT 1)),
('Hydraulic Pump', 'v2.1', 'High pressure hydraulic pump assembly', (SELECT id FROM auth.users LIMIT 1)),
('Control Panel', 'v1.5', 'Electronic control panel with display', (SELECT id FROM auth.users LIMIT 1))
ON CONFLICT (name, version) DO NOTHING;

-- Update existing work orders to have proper titles and production fields
UPDATE public.work_orders SET 
    title = 'Production Order ' || number,
    bom_id = (SELECT id FROM public.boms WHERE name = 'Engine Assembly' LIMIT 1),
    planned_start_date = now() + INTERVAL '1 day',
    planned_end_date = now() + INTERVAL '5 days'
WHERE bom_id IS NULL;

-- Insert production work orders with titles
INSERT INTO public.work_orders (number, title, bom_id, status, planned_start_date, planned_end_date, assigned_to, notes, created_by) VALUES
('WO-PROD-001', 'Engine Assembly Production', (SELECT id FROM public.boms WHERE name = 'Engine Assembly' LIMIT 1), 'planned', now() + INTERVAL '1 day', now() + INTERVAL '5 days', (SELECT id FROM auth.users LIMIT 1), 'Urgent order for customer ABC', (SELECT id FROM auth.users LIMIT 1)),
('WO-PROD-002', 'Hydraulic Pump Manufacturing', (SELECT id FROM public.boms WHERE name = 'Hydraulic Pump' LIMIT 1), 'in_progress', now() - INTERVAL '2 days', now() + INTERVAL '3 days', (SELECT id FROM auth.users LIMIT 1), 'Standard production run', (SELECT id FROM auth.users LIMIT 1)),
('WO-PROD-003', 'Control Panel Assembly', (SELECT id FROM public.boms WHERE name = 'Control Panel' LIMIT 1), 'testing', now() - INTERVAL '5 days', now() - INTERVAL '1 day', (SELECT id FROM auth.users LIMIT 1), 'Quality control batch', (SELECT id FROM auth.users LIMIT 1))
ON CONFLICT (number) DO NOTHING;

-- Executions
INSERT INTO public.executions (work_order_id, step_name, operator_id, start_time, end_time, notes) 
SELECT 
    wo.id,
    'Material Preparation',
    (SELECT id FROM auth.users LIMIT 1),
    now() - INTERVAL '2 days',
    now() - INTERVAL '2 days' + INTERVAL '2 hours',
    'Materials ready'
FROM public.work_orders wo
WHERE wo.number = 'WO-PROD-002'
ON CONFLICT DO NOTHING;

INSERT INTO public.executions (work_order_id, step_name, operator_id, start_time, end_time, notes) 
SELECT 
    wo.id,
    'Assembly Phase 1',
    (SELECT id FROM auth.users LIMIT 1),
    now() - INTERVAL '1 day',
    now() - INTERVAL '1 day' + INTERVAL '4 hours',
    'Base assembly completed'
FROM public.work_orders wo
WHERE wo.number = 'WO-PROD-002'
ON CONFLICT DO NOTHING;

-- Serials with proper UUID generation
INSERT INTO public.serials (serial_number, work_order_id, status, test_result, test_notes) 
SELECT 
    'SN-ENG-001',
    wo.id,
    'approved'::serial_status,
    'PASS',
    'All tests passed successfully'
FROM public.work_orders wo
WHERE wo.number = 'WO-PROD-003'
ON CONFLICT (serial_number) DO NOTHING;

INSERT INTO public.serials (serial_number, work_order_id, status, test_result, test_notes) 
SELECT 
    'SN-HYD-001',
    wo.id,
    'in_test'::serial_status,
    NULL,
    'Testing in progress'
FROM public.work_orders wo
WHERE wo.number = 'WO-PROD-002'
ON CONFLICT (serial_number) DO NOTHING;

-- RMA entries
INSERT INTO public.rma (rma_number, customer_id, serial_id, description, status, assigned_to, resolution_notes, created_by) 
SELECT 
    'RMA-PROD-001',
    (SELECT id FROM public.customers LIMIT 1),
    s.id,
    'Customer reports unusual noise during operation',
    'analysis'::rma_status,
    (SELECT id FROM auth.users LIMIT 1),
    'Initial inspection scheduled',
    (SELECT id FROM auth.users LIMIT 1)
FROM public.serials s
WHERE s.serial_number = 'SN-ENG-001'
ON CONFLICT (rma_number) DO NOTHING;