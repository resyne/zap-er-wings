-- Insert sample data with required title field
INSERT INTO public.boms (name, version, notes, created_by) VALUES
('Engine Assembly', 'v1.0', 'Main engine assembly with all components', (SELECT id FROM auth.users LIMIT 1)),
('Hydraulic Pump', 'v2.1', 'High pressure hydraulic pump assembly', (SELECT id FROM auth.users LIMIT 1)),
('Control Panel', 'v1.5', 'Electronic control panel with display', (SELECT id FROM auth.users LIMIT 1))
ON CONFLICT (name, version) DO NOTHING;

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
FROM public.items LIMIT 4
ON CONFLICT (bom_id, item_id) DO NOTHING;

-- Update existing work orders to have proper titles
UPDATE public.work_orders SET 
    title = 'Production Order ' || number,
    bom_id = (SELECT id FROM public.boms WHERE name = 'Engine Assembly' LIMIT 1),
    planned_start_date = now() + INTERVAL '1 day',
    planned_end_date = now() + INTERVAL '5 days'
WHERE title IS NULL OR bom_id IS NULL;

-- Insert production work orders with titles
INSERT INTO public.work_orders (number, title, bom_id, status, planned_start_date, planned_end_date, assigned_to, notes, created_by) VALUES
('WO-PROD-001', 'Engine Assembly Production', (SELECT id FROM public.boms WHERE name = 'Engine Assembly' LIMIT 1), 'planned', now() + INTERVAL '1 day', now() + INTERVAL '5 days', (SELECT id FROM auth.users LIMIT 1), 'Urgent order for customer ABC', (SELECT id FROM auth.users LIMIT 1)),
('WO-PROD-002', 'Hydraulic Pump Manufacturing', (SELECT id FROM public.boms WHERE name = 'Hydraulic Pump' LIMIT 1), 'in_progress', now() - INTERVAL '2 days', now() + INTERVAL '3 days', (SELECT id FROM auth.users LIMIT 1), 'Standard production run', (SELECT id FROM auth.users LIMIT 1)),
('WO-PROD-003', 'Control Panel Assembly', (SELECT id FROM public.boms WHERE name = 'Control Panel' LIMIT 1), 'testing', now() - INTERVAL '5 days', now() - INTERVAL '1 day', (SELECT id FROM auth.users LIMIT 1), 'Quality control batch', (SELECT id FROM auth.users LIMIT 1)),
('WO-PROD-004', 'Engine Batch Production', (SELECT id FROM public.boms WHERE name = 'Engine Assembly' LIMIT 1), 'closed', now() - INTERVAL '10 days', now() - INTERVAL '7 days', (SELECT id FROM auth.users LIMIT 1), 'Completed order', (SELECT id FROM auth.users LIMIT 1)),
('WO-PROD-005', 'Future Pump Production', (SELECT id FROM public.boms WHERE name = 'Hydraulic Pump' LIMIT 1), 'planned', now() + INTERVAL '7 days', now() + INTERVAL '14 days', (SELECT id FROM auth.users LIMIT 1), 'Future production planning', (SELECT id FROM auth.users LIMIT 1))
ON CONFLICT (number) DO NOTHING;

-- Executions
INSERT INTO public.executions (work_order_id, step_name, operator_id, start_time, end_time, notes) 
SELECT 
    wo.id,
    steps.step_name,
    (SELECT id FROM auth.users LIMIT 1),
    steps.start_time,
    steps.end_time,
    steps.notes
FROM public.work_orders wo
CROSS JOIN (
    VALUES 
        ('Material Preparation', now() - INTERVAL '2 days', now() - INTERVAL '2 days' + INTERVAL '2 hours', 'Materials ready'),
        ('Assembly Phase 1', now() - INTERVAL '1 day', now() - INTERVAL '1 day' + INTERVAL '4 hours', 'Base assembly completed'),
        ('Assembly Phase 2', now() - INTERVAL '4 hours', NULL, 'Currently in progress')
) AS steps(step_name, start_time, end_time, notes)
WHERE wo.number = 'WO-PROD-002'
ON CONFLICT DO NOTHING;

-- More executions for other work orders
INSERT INTO public.executions (work_order_id, step_name, operator_id, start_time, end_time, notes) 
SELECT 
    wo.id,
    'Final Assembly',
    (SELECT id FROM auth.users LIMIT 1),
    now() - INTERVAL '3 days',
    now() - INTERVAL '2 days',
    'Assembly completed'
FROM public.work_orders wo
WHERE wo.number = 'WO-PROD-003'
ON CONFLICT DO NOTHING;

-- Serials
INSERT INTO public.serials (serial_number, work_order_id, status, test_result, test_notes) 
SELECT 
    'SN-' || wo.number || '-' || generate_random_uuid()::text,
    wo.id,
    CASE 
        WHEN wo.status = 'closed' THEN 'approved'::serial_status
        WHEN wo.status = 'testing' THEN 'in_test'::serial_status
        ELSE 'in_test'::serial_status
    END,
    CASE WHEN wo.status = 'closed' THEN 'PASS' ELSE NULL END,
    CASE WHEN wo.status = 'closed' THEN 'All tests passed successfully' ELSE 'Testing in progress' END
FROM public.work_orders wo
WHERE wo.number IN ('WO-PROD-002', 'WO-PROD-003', 'WO-PROD-004')
ON CONFLICT (serial_number) DO NOTHING;

-- RMA entries
INSERT INTO public.rma (rma_number, customer_id, serial_id, description, status, assigned_to, resolution_notes, created_by) 
SELECT 
    'RMA-2024-' || LPAD((ROW_NUMBER() OVER())::text, 3, '0'),
    (SELECT id FROM public.customers LIMIT 1 OFFSET (ROW_NUMBER() OVER() - 1) % (SELECT COUNT(*) FROM public.customers)),
    s.id,
    CASE 
        WHEN ROW_NUMBER() OVER() = 1 THEN 'Customer reports unusual noise during operation'
        WHEN ROW_NUMBER() OVER() = 2 THEN 'Hydraulic pressure drop after 100 hours'
        ELSE 'Display intermittent failure'
    END,
    CASE 
        WHEN ROW_NUMBER() OVER() = 1 THEN 'analysis'::rma_status
        WHEN ROW_NUMBER() OVER() = 2 THEN 'repaired'::rma_status
        ELSE 'open'::rma_status
    END,
    (SELECT id FROM auth.users LIMIT 1),
    CASE 
        WHEN ROW_NUMBER() OVER() = 2 THEN 'Seal replaced, pressure restored'
        ELSE NULL
    END,
    (SELECT id FROM auth.users LIMIT 1)
FROM public.serials s
LIMIT 3
ON CONFLICT (rma_number) DO NOTHING;