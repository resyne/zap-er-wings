-- Tabella per gestire acconti su crediti clienti
CREATE TABLE IF NOT EXISTS public.customer_invoice_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_invoice_id UUID NOT NULL REFERENCES public.customer_invoices(id) ON DELETE CASCADE,
  advance_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabella per gestire assegni a copertura crediti clienti
CREATE TABLE IF NOT EXISTS public.customer_invoice_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_invoice_id UUID NOT NULL REFERENCES public.customer_invoices(id) ON DELETE CASCADE,
  check_number TEXT NOT NULL,
  check_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  bank TEXT,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabella per gestire acconti su debiti fornitori
CREATE TABLE IF NOT EXISTS public.supplier_invoice_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_invoice_id UUID NOT NULL REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
  advance_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabella per gestire assegni per pagamento debiti fornitori
CREATE TABLE IF NOT EXISTS public.supplier_invoice_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_invoice_id UUID NOT NULL REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
  check_number TEXT NOT NULL,
  check_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  bank TEXT,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_customer_invoice_advances_invoice ON public.customer_invoice_advances(customer_invoice_id);
CREATE INDEX IF NOT EXISTS idx_customer_invoice_checks_invoice ON public.customer_invoice_checks(customer_invoice_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_advances_invoice ON public.supplier_invoice_advances(supplier_invoice_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_checks_invoice ON public.supplier_invoice_checks(supplier_invoice_id);

-- RLS Policies per customer_invoice_advances
ALTER TABLE public.customer_invoice_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage customer invoice advances"
ON public.customer_invoice_advances
FOR ALL
USING (has_minimum_role(auth.uid(), 'user'::app_role))
WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Service role full access customer invoice advances"
ON public.customer_invoice_advances
FOR ALL
USING (true)
WITH CHECK (true);

-- RLS Policies per customer_invoice_checks
ALTER TABLE public.customer_invoice_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage customer invoice checks"
ON public.customer_invoice_checks
FOR ALL
USING (has_minimum_role(auth.uid(), 'user'::app_role))
WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Service role full access customer invoice checks"
ON public.customer_invoice_checks
FOR ALL
USING (true)
WITH CHECK (true);

-- RLS Policies per supplier_invoice_advances
ALTER TABLE public.supplier_invoice_advances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage supplier invoice advances"
ON public.supplier_invoice_advances
FOR ALL
USING (has_minimum_role(auth.uid(), 'user'::app_role))
WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Service role full access supplier invoice advances"
ON public.supplier_invoice_advances
FOR ALL
USING (true)
WITH CHECK (true);

-- RLS Policies per supplier_invoice_checks
ALTER TABLE public.supplier_invoice_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage supplier invoice checks"
ON public.supplier_invoice_checks
FOR ALL
USING (has_minimum_role(auth.uid(), 'user'::app_role))
WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Service role full access supplier invoice checks"
ON public.supplier_invoice_checks
FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger per aggiornamento automatico updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customer_invoice_advances_updated_at
BEFORE UPDATE ON public.customer_invoice_advances
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_invoice_checks_updated_at
BEFORE UPDATE ON public.customer_invoice_checks
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_invoice_advances_updated_at
BEFORE UPDATE ON public.supplier_invoice_advances
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplier_invoice_checks_updated_at
BEFORE UPDATE ON public.supplier_invoice_checks
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();