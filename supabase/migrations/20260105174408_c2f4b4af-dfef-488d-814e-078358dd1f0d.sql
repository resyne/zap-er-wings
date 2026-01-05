
-- Archive all 2025 sales orders
UPDATE public.sales_orders 
SET archived = true 
WHERE EXTRACT(YEAR FROM order_date) = 2025;

-- Archive all 2025 DDTs  
UPDATE public.ddts 
SET archived = true 
WHERE EXTRACT(YEAR FROM created_at) = 2025 
   OR EXTRACT(YEAR FROM document_date) = 2025;

-- Archive all 2025 service reports
UPDATE public.service_reports 
SET archived = true 
WHERE EXTRACT(YEAR FROM intervention_date) = 2025;
