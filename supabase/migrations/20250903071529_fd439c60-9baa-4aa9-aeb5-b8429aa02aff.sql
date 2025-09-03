-- Controllo di Gestione Database Schema - Fixed version

-- 1. Piano dei Conti (Chart of Accounts)
CREATE TABLE public.chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL, -- 'revenue', 'cost', 'opex', 'capex'
  category TEXT, -- 'machines', 'installations', 'service', 'materials', 'labor', 'transport', 'personnel', 'marketing', 'administration'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Centri di Costo (Cost Centers)
CREATE TABLE public.cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Centri di Profitto (Profit Centers)
CREATE TABLE public.profit_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  machine_model TEXT, -- per modelli macchine specifici
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Standard Costs
CREATE TABLE public.standard_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_type TEXT NOT NULL, -- 'technician_hour', 'transport_per_job', 'material_kit'
  description TEXT NOT NULL,
  unit_cost NUMERIC(10,2) NOT NULL,
  unit TEXT NOT NULL, -- 'hour', 'job', 'kit'
  machine_model TEXT, -- per kit materiali specifici
  valid_from DATE NOT NULL,
  valid_to DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. KPI Drivers
CREATE TABLE public.kpi_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL,
  target_value NUMERIC(10,2),
  current_value NUMERIC(10,2),
  period_type TEXT DEFAULT 'monthly', -- 'monthly', 'quarterly', 'yearly'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Commesse (Projects/Jobs)
CREATE TABLE public.management_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  customer_id UUID,
  customer_name TEXT NOT NULL,
  machine_model TEXT,
  project_type TEXT NOT NULL, -- 'machine', 'installation', 'service'
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'cancelled'
  start_date DATE,
  end_date DATE,
  estimated_revenue NUMERIC(12,2),
  actual_revenue NUMERIC(12,2) DEFAULT 0,
  estimated_costs NUMERIC(12,2),
  actual_costs NUMERIC(12,2) DEFAULT 0,
  profit_center_id UUID REFERENCES public.profit_centers(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Fatture Clienti (Customer Invoices)
CREATE TABLE public.customer_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  customer_id UUID,
  customer_name TEXT NOT NULL,
  project_id UUID REFERENCES public.management_projects(id),
  profit_center_id UUID REFERENCES public.profit_centers(id),
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'open', -- 'open', 'paid', 'overdue', 'cancelled'
  payment_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Fatture Fornitori (Supplier Invoices)  
CREATE TABLE public.supplier_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL,
  supplier_id UUID,
  supplier_name TEXT NOT NULL,
  project_id UUID REFERENCES public.management_projects(id),
  cost_center_id UUID REFERENCES public.cost_centers(id),
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'open', -- 'open', 'paid', 'overdue'
  payment_date DATE,
  category TEXT NOT NULL, -- 'materials', 'transport', 'opex'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Timesheet
CREATE TABLE public.management_timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id UUID,
  technician_name TEXT NOT NULL,
  project_id UUID REFERENCES public.management_projects(id),
  date DATE NOT NULL,
  hours NUMERIC(5,2) NOT NULL,
  hourly_rate NUMERIC(8,2) NOT NULL,
  total_cost NUMERIC(10,2) GENERATED ALWAYS AS (hours * hourly_rate) STORED,
  activity_type TEXT, -- 'installation', 'service', 'maintenance'
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Materiali su Commessa
CREATE TABLE public.project_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.management_projects(id) NOT NULL,
  material_id UUID,
  material_name TEXT NOT NULL,
  quantity NUMERIC(10,3) NOT NULL,
  unit_cost NUMERIC(10,2) NOT NULL,
  total_cost NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  usage_date DATE,
  is_kit BOOLEAN DEFAULT false, -- true se è un kit standard
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Spese Logistica
CREATE TABLE public.logistics_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.management_projects(id) NOT NULL,
  expense_type TEXT NOT NULL, -- 'transport', 'rental', 'courier'
  description TEXT,
  amount NUMERIC(10,2) NOT NULL,
  expense_date DATE NOT NULL,
  supplier_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 12. Prima Nota (Ledger Entries)
CREATE TABLE public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL,
  entry_type TEXT NOT NULL, -- 'receipt', 'payment', 'expense', 'transfer'
  amount NUMERIC(12,2) NOT NULL,
  description TEXT NOT NULL,
  customer_invoice_id UUID REFERENCES public.customer_invoices(id),
  supplier_invoice_id UUID REFERENCES public.supplier_invoices(id),
  cost_center_id UUID REFERENCES public.cost_centers(id),
  profit_center_id UUID REFERENCES public.profit_centers(id),
  bank_account TEXT,
  reference_number TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 13. Budget
CREATE TABLE public.budget (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  account_id UUID REFERENCES public.chart_of_accounts(id) NOT NULL,
  cost_center_id UUID REFERENCES public.cost_centers(id),
  profit_center_id UUID REFERENCES public.profit_centers(id),
  budgeted_amount NUMERIC(12,2) NOT NULL,
  actual_amount NUMERIC(12,2) DEFAULT 0,
  variance NUMERIC(12,2) GENERATED ALWAYS AS (actual_amount - budgeted_amount) STORED,
  variance_percent NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN budgeted_amount = 0 THEN 0 
      ELSE ((actual_amount - budgeted_amount) / budgeted_amount * 100) 
    END
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(year, month, account_id, cost_center_id, profit_center_id)
);

-- 14. Forecast
CREATE TABLE public.forecast (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_date DATE NOT NULL,
  scenario TEXT DEFAULT 'base', -- 'best', 'base', 'worst'
  project_id UUID REFERENCES public.management_projects(id),
  forecast_type TEXT NOT NULL, -- 'revenue', 'cash_inflow', 'cash_outflow'
  amount NUMERIC(12,2) NOT NULL,
  probability NUMERIC(3,0) DEFAULT 100, -- percentuale di probabilità
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 15. Contratti Service
CREATE TABLE public.service_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number TEXT NOT NULL UNIQUE,
  customer_id UUID,
  customer_name TEXT NOT NULL,
  machine_model TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  monthly_revenue NUMERIC(10,2) NOT NULL,
  annual_revenue NUMERIC(12,2) GENERATED ALWAYS AS (monthly_revenue * 12) STORED,
  status TEXT DEFAULT 'active', -- 'active', 'expired', 'cancelled'
  renewal_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add aging days calculation functions
CREATE OR REPLACE FUNCTION calculate_aging_days(status TEXT, due_date DATE, payment_date DATE)
RETURNS INTEGER AS $$
BEGIN
  IF status = 'paid' THEN
    RETURN 0;
  ELSE
    RETURN (CURRENT_DATE - due_date)::INTEGER;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION calculate_days_to_renewal(renewal_date DATE)
RETURNS INTEGER AS $$
BEGIN
  RETURN (renewal_date - CURRENT_DATE)::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add calculated columns
ALTER TABLE public.customer_invoices ADD COLUMN aging_days INTEGER;
ALTER TABLE public.supplier_invoices ADD COLUMN aging_days INTEGER;
ALTER TABLE public.service_contracts ADD COLUMN days_to_renewal INTEGER;

-- Enable RLS on all tables
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profit_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standard_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.management_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.management_timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_contracts ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can view/manage if they have minimum user role
CREATE POLICY "Users can manage chart of accounts" ON public.chart_of_accounts FOR ALL USING (has_minimum_role(auth.uid(), 'user'::app_role));
CREATE POLICY "Users can manage cost centers" ON public.cost_centers FOR ALL USING (has_minimum_role(auth.uid(), 'user'::app_role));
CREATE POLICY "Users can manage profit centers" ON public.profit_centers FOR ALL USING (has_minimum_role(auth.uid(), 'user'::app_role));
CREATE POLICY "Users can manage standard costs" ON public.standard_costs FOR ALL USING (has_minimum_role(auth.uid(), 'user'::app_role));
CREATE POLICY "Users can manage kpi drivers" ON public.kpi_drivers FOR ALL USING (has_minimum_role(auth.uid(), 'user'::app_role));
CREATE POLICY "Users can manage projects" ON public.management_projects FOR ALL USING (has_minimum_role(auth.uid(), 'user'::app_role));
CREATE POLICY "Users can manage customer invoices" ON public.customer_invoices FOR ALL USING (has_minimum_role(auth.uid(), 'user'::app_role));
CREATE POLICY "Users can manage supplier invoices" ON public.supplier_invoices FOR ALL USING (has_minimum_role(auth.uid(), 'user'::app_role));
CREATE POLICY "Users can manage timesheets" ON public.management_timesheets FOR ALL USING (has_minimum_role(auth.uid(), 'user'::app_role));
CREATE POLICY "Users can manage project materials" ON public.project_materials FOR ALL USING (has_minimum_role(auth.uid(), 'user'::app_role));
CREATE POLICY "Users can manage logistics expenses" ON public.logistics_expenses FOR ALL USING (has_minimum_role(auth.uid(), 'user'::app_role));
CREATE POLICY "Users can manage ledger entries" ON public.ledger_entries FOR ALL USING (has_minimum_role(auth.uid(), 'user'::app_role));
CREATE POLICY "Users can manage budget" ON public.budget FOR ALL USING (has_minimum_role(auth.uid(), 'user'::app_role));
CREATE POLICY "Users can manage forecast" ON public.forecast FOR ALL USING (has_minimum_role(auth.uid(), 'user'::app_role));
CREATE POLICY "Users can manage service contracts" ON public.service_contracts FOR ALL USING (has_minimum_role(auth.uid(), 'user'::app_role));

-- Service role policies
CREATE POLICY "Service role full access chart of accounts" ON public.chart_of_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access cost centers" ON public.cost_centers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access profit centers" ON public.profit_centers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access standard costs" ON public.standard_costs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access kpi drivers" ON public.kpi_drivers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access projects" ON public.management_projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access customer invoices" ON public.customer_invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access supplier invoices" ON public.supplier_invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access timesheets" ON public.management_timesheets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access project materials" ON public.project_materials FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access logistics expenses" ON public.logistics_expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access ledger entries" ON public.ledger_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access budget" ON public.budget FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access forecast" ON public.forecast FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access service contracts" ON public.service_contracts FOR ALL USING (true) WITH CHECK (true);

-- Triggers for updated_at
CREATE TRIGGER update_chart_of_accounts_updated_at BEFORE UPDATE ON public.chart_of_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cost_centers_updated_at BEFORE UPDATE ON public.cost_centers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profit_centers_updated_at BEFORE UPDATE ON public.profit_centers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_standard_costs_updated_at BEFORE UPDATE ON public.standard_costs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_kpi_drivers_updated_at BEFORE UPDATE ON public.kpi_drivers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_management_projects_updated_at BEFORE UPDATE ON public.management_projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customer_invoices_updated_at BEFORE UPDATE ON public.customer_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_supplier_invoices_updated_at BEFORE UPDATE ON public.supplier_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_management_timesheets_updated_at BEFORE UPDATE ON public.management_timesheets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_project_materials_updated_at BEFORE UPDATE ON public.project_materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_logistics_expenses_updated_at BEFORE UPDATE ON public.logistics_expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ledger_entries_updated_at BEFORE UPDATE ON public.ledger_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_budget_updated_at BEFORE UPDATE ON public.budget FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_forecast_updated_at BEFORE UPDATE ON public.forecast FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_service_contracts_updated_at BEFORE UPDATE ON public.service_contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Triggers for aging calculation
CREATE OR REPLACE FUNCTION update_aging_days()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'customer_invoices' THEN
    NEW.aging_days := calculate_aging_days(NEW.status, NEW.due_date, NEW.payment_date);
  ELSIF TG_TABLE_NAME = 'supplier_invoices' THEN
    NEW.aging_days := calculate_aging_days(NEW.status, NEW.due_date, NEW.payment_date);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_days_to_renewal()
RETURNS TRIGGER AS $$
BEGIN
  NEW.days_to_renewal := calculate_days_to_renewal(NEW.renewal_date);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customer_invoices_aging BEFORE INSERT OR UPDATE ON public.customer_invoices FOR EACH ROW EXECUTE FUNCTION update_aging_days();
CREATE TRIGGER update_supplier_invoices_aging BEFORE INSERT OR UPDATE ON public.supplier_invoices FOR EACH ROW EXECUTE FUNCTION update_aging_days();
CREATE TRIGGER update_service_contracts_renewal BEFORE INSERT OR UPDATE ON public.service_contracts FOR EACH ROW EXECUTE FUNCTION update_days_to_renewal();

-- Indexes for performance
CREATE INDEX idx_customer_invoices_aging ON public.customer_invoices(aging_days);
CREATE INDEX idx_supplier_invoices_aging ON public.supplier_invoices(aging_days);
CREATE INDEX idx_management_projects_status ON public.management_projects(status);
CREATE INDEX idx_service_contracts_renewal ON public.service_contracts(days_to_renewal);
CREATE INDEX idx_budget_year_month ON public.budget(year, month);
CREATE INDEX idx_ledger_entries_date ON public.ledger_entries(entry_date);

-- Insert default data
INSERT INTO public.cost_centers (code, name, description) VALUES
('CC001', 'Produzione', 'Centro di costo per attività produttive'),
('CC002', 'Installazioni', 'Centro di costo per installazioni'),
('CC003', 'Service/Manutenzione', 'Centro di costo per service e manutenzione'),
('CC004', 'Commerciale & Marketing', 'Centro di costo per attività commerciali e marketing'),
('CC005', 'Amministrazione', 'Centro di costo per attività amministrative');

INSERT INTO public.profit_centers (code, name, description) VALUES
('PC001', 'Macchine', 'Centro di profitto per vendita macchine'),
('PC002', 'Installazioni', 'Centro di profitto per installazioni'),
('PC003', 'Service/Manutenzione', 'Centro di profitto per service e manutenzione');

INSERT INTO public.chart_of_accounts (code, name, account_type, category) VALUES
('R001', 'Ricavi Macchine', 'revenue', 'machines'),
('R002', 'Ricavi Installazioni', 'revenue', 'installations'),
('R003', 'Ricavi Service/Manutenzione', 'revenue', 'service'),
('C001', 'Costi Materiali', 'cost', 'materials'),
('C002', 'Costi Manodopera', 'cost', 'labor'),
('C003', 'Costi Trasporto/Logistica', 'cost', 'transport'),
('O001', 'Personale', 'opex', 'personnel'),
('O002', 'Marketing', 'opex', 'marketing'),
('O003', 'Amministrazione', 'opex', 'administration'),
('X001', 'One-off / Capex', 'capex', 'equipment');

INSERT INTO public.standard_costs (cost_type, description, unit_cost, unit, valid_from) VALUES
('technician_hour', 'Ora tecnico installazione standard', 45.00, 'hour', CURRENT_DATE),
('transport_per_job', 'Trasporto medio per consegna', 150.00, 'job', CURRENT_DATE);

INSERT INTO public.kpi_drivers (name, description, unit, target_value) VALUES
('Macchine Prodotte', 'Numero di macchine prodotte al mese', 'units', 20),
('Macchine Vendute', 'Numero di macchine vendute al mese', 'units', 18),
('Installazioni', 'Numero di installazioni al mese', 'units', 15),
('Contratti Manutenzione Attivi', 'Numero di contratti di manutenzione attivi', 'contracts', 50);