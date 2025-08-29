-- Create service_work_orders table for Technical Support Work Orders (OdL)
CREATE TABLE public.service_work_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  customer_id UUID REFERENCES public.customers(id),
  contact_id UUID REFERENCES public.crm_contacts(id),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'testing', 'closed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to UUID,
  scheduled_date TIMESTAMP WITH TIME ZONE,
  actual_start_date TIMESTAMP WITH TIME ZONE,
  actual_end_date TIMESTAMP WITH TIME ZONE,
  estimated_hours NUMERIC,
  actual_hours NUMERIC,
  location TEXT,
  equipment_needed TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.service_work_orders ENABLE ROW LEVEL SECURITY;

-- Create policies for service work orders
CREATE POLICY "Users can view service work orders" 
ON public.service_work_orders 
FOR SELECT 
USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can create service work orders" 
ON public.service_work_orders 
FOR INSERT 
WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Moderators can update service work orders" 
ON public.service_work_orders 
FOR UPDATE 
USING (has_minimum_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins can delete service work orders" 
ON public.service_work_orders 
FOR DELETE 
USING (has_minimum_role(auth.uid(), 'admin'::app_role));

-- Create sequence for service work orders (OdL)
CREATE SEQUENCE IF NOT EXISTS service_work_order_sequence START 1;

-- Create function to generate service work order numbers (OdL)
CREATE OR REPLACE FUNCTION public.generate_service_work_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    RETURN 'OdL-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('service_work_order_sequence')::TEXT, 4, '0');
END;
$$;

-- Create trigger to auto-generate service work order numbers
CREATE OR REPLACE FUNCTION public.auto_generate_service_work_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF NEW.number IS NULL OR NEW.number = '' THEN
        NEW.number := generate_service_work_order_number();
    END IF;
    RETURN NEW;
END;
$$;

-- Create trigger for automatic number generation
CREATE TRIGGER trigger_auto_generate_service_work_order_number
BEFORE INSERT ON public.service_work_orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_service_work_order_number();

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_service_work_orders_updated_at
BEFORE UPDATE ON public.service_work_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update existing work_orders sequence and function to use OdP prefix
-- Create sequence for production work orders (OdP) if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS production_work_order_sequence START 1;

-- Update function to generate production work order numbers (OdP)
CREATE OR REPLACE FUNCTION public.generate_production_work_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    RETURN 'OdP-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('production_work_order_sequence')::TEXT, 4, '0');
END;
$$;

-- Update trigger function for production work orders
CREATE OR REPLACE FUNCTION public.auto_generate_production_work_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF NEW.number IS NULL OR NEW.number = '' THEN
        NEW.number := generate_production_work_order_number();
    END IF;
    RETURN NEW;
END;
$$;

-- Drop old trigger if exists and create new one for production work orders
DROP TRIGGER IF EXISTS trigger_auto_generate_work_order_number ON public.work_orders;
CREATE TRIGGER trigger_auto_generate_production_work_order_number
BEFORE INSERT ON public.work_orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_production_work_order_number();