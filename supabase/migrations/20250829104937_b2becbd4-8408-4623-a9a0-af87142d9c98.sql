-- Add new columns to service_reports table for enhanced functionality
ALTER TABLE public.service_reports 
ADD COLUMN technician_id UUID REFERENCES public.technicians(id),
ADD COLUMN work_order_id UUID REFERENCES public.service_work_orders(id),
ADD COLUMN production_work_order_id UUID REFERENCES public.work_orders(id);

-- Make description optional
ALTER TABLE public.service_reports 
ALTER COLUMN description DROP NOT NULL;

-- Make technician_name optional since we now have technician_id
ALTER TABLE public.service_reports 
ALTER COLUMN technician_name DROP NOT NULL;