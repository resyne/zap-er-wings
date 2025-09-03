-- Create table for journal entries/movements
CREATE TABLE public.journal_entries (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('sale', 'purchase', 'other')),
    amount NUMERIC NOT NULL DEFAULT 0,
    description TEXT NOT NULL,
    reference_number TEXT,
    
    -- Links to management control entities
    profit_center_id UUID REFERENCES public.profit_centers(id),
    project_id UUID REFERENCES public.management_projects(id),
    account_id UUID REFERENCES public.chart_of_accounts(id) NOT NULL,
    
    -- Additional fields
    document_type TEXT, -- Invoice, Receipt, etc.
    document_number TEXT,
    supplier_customer_name TEXT,
    vat_amount NUMERIC DEFAULT 0,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    
    -- Metadata
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    -- Status and flags
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'posted')),
    is_imported BOOLEAN DEFAULT false,
    import_source TEXT
);

-- Enable RLS
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view journal entries" 
ON public.journal_entries 
FOR SELECT 
USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Moderators can manage journal entries" 
ON public.journal_entries 
FOR ALL 
USING (has_minimum_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_minimum_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Service role full access journal entries" 
ON public.journal_entries 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_journal_entries_entry_date ON public.journal_entries(entry_date);
CREATE INDEX idx_journal_entries_entry_type ON public.journal_entries(entry_type);
CREATE INDEX idx_journal_entries_profit_center ON public.journal_entries(profit_center_id);
CREATE INDEX idx_journal_entries_project ON public.journal_entries(project_id);
CREATE INDEX idx_journal_entries_account ON public.journal_entries(account_id);
CREATE INDEX idx_journal_entries_status ON public.journal_entries(status);

-- Create trigger for updated_at
CREATE TRIGGER update_journal_entries_updated_at
    BEFORE UPDATE ON public.journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();