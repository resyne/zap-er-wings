-- Enable RLS on accounting tables
ALTER TABLE public.accounting_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_template_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.structural_accounts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies and recreate them
DROP POLICY IF EXISTS "accounting_rules_select_policy" ON public.accounting_rules;
DROP POLICY IF EXISTS "accounting_templates_select_policy" ON public.accounting_templates;
DROP POLICY IF EXISTS "accounting_template_lines_select_policy" ON public.accounting_template_lines;
DROP POLICY IF EXISTS "structural_accounts_select_policy" ON public.structural_accounts;

-- Create SELECT policies for authenticated users (read-only for now)
CREATE POLICY "accounting_rules_select_policy"
ON public.accounting_rules FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "accounting_templates_select_policy"
ON public.accounting_templates FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "accounting_template_lines_select_policy"
ON public.accounting_template_lines FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "structural_accounts_select_policy"
ON public.structural_accounts FOR SELECT
TO authenticated
USING (true);