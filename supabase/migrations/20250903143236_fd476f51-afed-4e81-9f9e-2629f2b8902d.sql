-- Create basic chart of accounts for invoice import functionality
INSERT INTO public.chart_of_accounts (code, name, account_type, parent_code, is_active, created_at, updated_at) 
VALUES 
  ('2010', 'Debiti verso fornitori', 'liability', '2000', true, now(), now()),
  ('1410', 'IVA a credito', 'asset', '1400', true, now(), now()),
  ('4010', 'Acquisti di materie prime', 'expense', '4000', true, now(), now())
ON CONFLICT (code) DO NOTHING;