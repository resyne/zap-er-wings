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

-- Update existing work_orders table to match production requirements
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS bom_id UUID REFERENCES public.boms(id);
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS planned_start_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS planned_end_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS actual_start_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS actual_end_date TIMESTAMP WITH TIME ZONE;

-- Drop existing status column if it's different type and recreate
DO $$ 
BEGIN
    -- Check if we need to update the status column type
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_orders' AND column_name = 'status' AND data_type != 'USER-DEFINED') THEN
        ALTER TABLE public.work_orders DROP COLUMN status;
        ALTER TABLE public.work_orders ADD COLUMN status wo_status NOT NULL DEFAULT 'planned';
    END IF;
END $$;

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