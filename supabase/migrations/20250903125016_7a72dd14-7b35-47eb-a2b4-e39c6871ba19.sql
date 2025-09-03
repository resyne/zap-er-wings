-- Create enum types for general ledger
CREATE TYPE gl_doc_type AS ENUM (
  'SaleInvoice',
  'PurchaseInvoice', 
  'Manual',
  'Timesheet',
  'MaterialIssue',
  'Logistics',
  'Adjustment',
  'Opening'
);

CREATE TYPE gl_origin_module AS ENUM (
  'Sales',
  'Purchases', 
  'Warehouse',
  'Timesheet',
  'Finance',
  'Manual'
);

CREATE TYPE gl_status AS ENUM (
  'draft',
  'incomplete',
  'posted'
);

-- Create gl_entry table (movement header)
CREATE TABLE public.gl_entry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  doc_type gl_doc_type NOT NULL,
  doc_ref TEXT,
  description TEXT NOT NULL,
  cost_center_id UUID REFERENCES public.profit_centers(id),
  profit_center_id UUID REFERENCES public.profit_centers(id),
  job_id UUID REFERENCES public.management_projects(id),
  origin_module gl_origin_module NOT NULL DEFAULT 'Manual',
  status gl_status NOT NULL DEFAULT 'draft',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create gl_entry_line table (accounting lines)
CREATE TABLE public.gl_entry_line (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gl_entry_id UUID NOT NULL REFERENCES public.gl_entry(id) ON DELETE CASCADE,
  gl_account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  debit NUMERIC DEFAULT 0 CHECK (debit >= 0),
  credit NUMERIC DEFAULT 0 CHECK (credit >= 0),
  vat_rate NUMERIC,
  cost_center_id UUID REFERENCES public.profit_centers(id),
  profit_center_id UUID REFERENCES public.profit_centers(id),
  job_id UUID REFERENCES public.management_projects(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT debit_xor_credit CHECK (
    (debit > 0 AND credit = 0) OR 
    (credit > 0 AND debit = 0) OR 
    (debit = 0 AND credit = 0)
  )
);

-- Enable RLS on both tables
ALTER TABLE public.gl_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gl_entry_line ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for gl_entry
CREATE POLICY "Users can view gl entries" 
ON public.gl_entry 
FOR SELECT 
USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Moderators can manage gl entries" 
ON public.gl_entry 
FOR ALL 
USING (has_minimum_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_minimum_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Service role full access gl entries" 
ON public.gl_entry 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create RLS policies for gl_entry_line
CREATE POLICY "Users can view gl entry lines" 
ON public.gl_entry_line 
FOR SELECT 
USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Moderators can manage gl entry lines" 
ON public.gl_entry_line 
FOR ALL 
USING (has_minimum_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_minimum_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Service role full access gl entry lines" 
ON public.gl_entry_line 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_gl_entry_date ON public.gl_entry(date);
CREATE INDEX idx_gl_entry_doc_type ON public.gl_entry(doc_type);
CREATE INDEX idx_gl_entry_origin_module ON public.gl_entry(origin_module);
CREATE INDEX idx_gl_entry_cost_center ON public.gl_entry(cost_center_id);
CREATE INDEX idx_gl_entry_profit_center ON public.gl_entry(profit_center_id);
CREATE INDEX idx_gl_entry_job ON public.gl_entry(job_id);
CREATE INDEX idx_gl_entry_line_account ON public.gl_entry_line(gl_account_id);
CREATE INDEX idx_gl_entry_line_entry ON public.gl_entry_line(gl_entry_id);

-- Add triggers for updated_at
CREATE TRIGGER update_gl_entry_updated_at
BEFORE UPDATE ON public.gl_entry
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_gl_entry_line_updated_at
BEFORE UPDATE ON public.gl_entry_line
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();