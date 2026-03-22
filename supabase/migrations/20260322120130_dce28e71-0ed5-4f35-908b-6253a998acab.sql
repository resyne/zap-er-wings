
-- Cost categories table
CREATE TABLE IF NOT EXISTS public.cost_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  cost_type text NOT NULL DEFAULT 'variable' CHECK (cost_type IN ('fixed', 'variable')),
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Management costs table
CREATE TABLE IF NOT EXISTS public.management_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  description text NOT NULL,
  supplier_id uuid REFERENCES public.customers(id),
  supplier_name text,
  category_id uuid REFERENCES public.cost_categories(id),
  category_name text,
  cost_type text NOT NULL CHECK (cost_type IN ('fixed', 'variable')),
  cost_nature text NOT NULL DEFAULT 'direct' CHECK (cost_nature IN ('direct', 'indirect')),
  amount numeric NOT NULL,
  vat_rate numeric,
  vat_amount numeric,
  net_amount numeric,
  frequency text NOT NULL DEFAULT 'one_time' CHECK (frequency IN ('one_time', 'monthly', 'quarterly', 'annual')),
  cost_center_id uuid REFERENCES public.cost_centers(id),
  business_unit_id uuid REFERENCES public.business_units(id),
  commessa_id uuid REFERENCES public.commesse(id),
  sales_order_id uuid REFERENCES public.sales_orders(id),
  customer_id uuid REFERENCES public.customers(id),
  product_id uuid REFERENCES public.products(id),
  payment_method text,
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  source text DEFAULT 'manual',
  source_id text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Management settings table
CREATE TABLE IF NOT EXISTS public.management_control_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL DEFAULT '{}',
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cost_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.management_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.management_control_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can read cost_categories" ON public.cost_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage cost_categories" ON public.cost_categories FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE POLICY "Authenticated users can read management_costs" ON public.management_costs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert management_costs" ON public.management_costs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can update management_costs" ON public.management_costs FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "Admins can delete management_costs" ON public.management_costs FOR DELETE TO authenticated USING (public.is_admin_user());

CREATE POLICY "Authenticated users can read management_control_settings" ON public.management_control_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage management_control_settings" ON public.management_control_settings FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Triggers for updated_at
CREATE TRIGGER set_updated_at_cost_categories BEFORE UPDATE ON public.cost_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_management_costs BEFORE UPDATE ON public.management_costs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_management_control_settings BEFORE UPDATE ON public.management_control_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Insert default cost categories
INSERT INTO public.cost_categories (name, cost_type, sort_order) VALUES
  ('Affitto', 'fixed', 1),
  ('Stipendi', 'fixed', 2),
  ('Collaboratori', 'variable', 3),
  ('Marketing', 'variable', 4),
  ('Software / SaaS', 'fixed', 5),
  ('Produzione', 'variable', 6),
  ('Logistica', 'variable', 7),
  ('Commissioni', 'variable', 8),
  ('Spedizioni', 'variable', 9),
  ('Consulenze', 'fixed', 10),
  ('Utenze', 'fixed', 11),
  ('Noleggi', 'fixed', 12),
  ('Manutenzione', 'fixed', 13),
  ('Materie prime', 'variable', 14),
  ('Altro', 'variable', 15);

-- Insert default settings
INSERT INTO public.management_control_settings (setting_key, setting_value, description) VALUES
  ('competence_logic', '"invoice_date"', 'Logica di competenza: invoice_date o payment_date'),
  ('fixed_cost_allocation', '"not_allocated"', 'Allocazione costi fissi: not_allocated, percentage, manual'),
  ('margin_warning_threshold', '10', 'Soglia minima margine netto % per alert'),
  ('fixed_cost_ratio_threshold', '60', 'Soglia massima % costi fissi su ricavi per alert');
