-- Generate sample data for production module
INSERT INTO public.boms (name, version, notes, created_by) VALUES
('Engine Assembly', 'v1.0', 'Main engine assembly with all components', (SELECT id FROM auth.users LIMIT 1)),
('Hydraulic Pump', 'v2.1', 'High pressure hydraulic pump assembly', (SELECT id FROM auth.users LIMIT 1)),
('Control Panel', 'v1.5', 'Electronic control panel with display', (SELECT id FROM auth.users LIMIT 1));

-- BOM Items (link to existing items)
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

-- Update existing work orders with production data
UPDATE public.work_orders SET 
    bom_id = (SELECT id FROM public.boms WHERE name = 'Engine Assembly' LIMIT 1),
    status = 'planned',
    planned_start_date = now() + INTERVAL '1 day',
    planned_end_date = now() + INTERVAL '5 days'
WHERE number = (SELECT number FROM public.work_orders LIMIT 1);

-- Insert additional work orders if needed
INSERT INTO public.work_orders (number, bom_id, status, planned_start_date, planned_end_date, assigned_to, notes, created_by) VALUES
('WO-2024-001', (SELECT id FROM public.boms WHERE name = 'Engine Assembly' LIMIT 1), 'planned', now() + INTERVAL '1 day', now() + INTERVAL '5 days', (SELECT id FROM auth.users LIMIT 1), 'Urgent order for customer ABC', (SELECT id FROM auth.users LIMIT 1)),
('WO-2024-002', (SELECT id FROM public.boms WHERE name = 'Hydraulic Pump' LIMIT 1), 'in_progress', now() - INTERVAL '2 days', now() + INTERVAL '3 days', (SELECT id FROM auth.users LIMIT 1), 'Standard production run', (SELECT id FROM auth.users LIMIT 1)),
('WO-2024-003', (SELECT id FROM public.boms WHERE name = 'Control Panel' LIMIT 1), 'testing', now() - INTERVAL '5 days', now() - INTERVAL '1 day', (SELECT id FROM auth.users LIMIT 1), 'Quality control batch', (SELECT id FROM auth.users LIMIT 1)),
('WO-2024-004', (SELECT id FROM public.boms WHERE name = 'Engine Assembly' LIMIT 1), 'closed', now() - INTERVAL '10 days', now() - INTERVAL '7 days', (SELECT id FROM auth.users LIMIT 1), 'Completed order', (SELECT id FROM auth.users LIMIT 1)),
('WO-2024-005', (SELECT id FROM public.boms WHERE name = 'Hydraulic Pump' LIMIT 1), 'planned', now() + INTERVAL '7 days', now() + INTERVAL '14 days', (SELECT id FROM auth.users LIMIT 1), 'Future production planning', (SELECT id FROM auth.users LIMIT 1))
ON CONFLICT (number) DO NOTHING;

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