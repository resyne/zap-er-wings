-- Create CRM tables for Bigin integration
CREATE TABLE public.crm_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bigin_id TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  company_id UUID,
  job_title TEXT,
  lead_source TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  synced_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE public.crm_companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bigin_id TEXT UNIQUE,
  name TEXT NOT NULL,
  website TEXT,
  phone TEXT,
  email TEXT,
  industry TEXT,
  employees_count INTEGER,
  annual_revenue NUMERIC,
  billing_address TEXT,
  shipping_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  synced_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE public.crm_deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bigin_id TEXT UNIQUE,
  name TEXT NOT NULL,
  amount NUMERIC,
  stage TEXT,
  probability NUMERIC,
  contact_id UUID REFERENCES crm_contacts(id),
  company_id UUID REFERENCES crm_companies(id),
  expected_close_date DATE,
  assigned_to UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  synced_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE public.crm_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bigin_id TEXT UNIQUE,
  title TEXT,
  content TEXT,
  contact_id UUID REFERENCES crm_contacts(id),
  company_id UUID REFERENCES crm_companies(id),
  deal_id UUID REFERENCES crm_deals(id),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  synced_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow authenticated users to view contacts" ON public.crm_contacts FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to insert contacts" ON public.crm_contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update contacts" ON public.crm_contacts FOR UPDATE USING (true);
CREATE POLICY "Allow authenticated users to delete contacts" ON public.crm_contacts FOR DELETE USING (true);

CREATE POLICY "Allow authenticated users to view companies" ON public.crm_companies FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to insert companies" ON public.crm_companies FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update companies" ON public.crm_companies FOR UPDATE USING (true);
CREATE POLICY "Allow authenticated users to delete companies" ON public.crm_companies FOR DELETE USING (true);

CREATE POLICY "Allow authenticated users to view deals" ON public.crm_deals FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to insert deals" ON public.crm_deals FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update deals" ON public.crm_deals FOR UPDATE USING (true);
CREATE POLICY "Allow authenticated users to delete deals" ON public.crm_deals FOR DELETE USING (true);

CREATE POLICY "Allow authenticated users to view notes" ON public.crm_notes FOR SELECT USING (true);
CREATE POLICY "Allow authenticated users to insert notes" ON public.crm_notes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update notes" ON public.crm_notes FOR UPDATE USING (true);
CREATE POLICY "Allow authenticated users to delete notes" ON public.crm_notes FOR DELETE USING (true);

-- Add foreign key for company_id in contacts
ALTER TABLE public.crm_contacts ADD CONSTRAINT fk_contact_company 
  FOREIGN KEY (company_id) REFERENCES public.crm_companies(id);

-- Create indexes for better performance
CREATE INDEX idx_crm_contacts_bigin_id ON public.crm_contacts(bigin_id);
CREATE INDEX idx_crm_companies_bigin_id ON public.crm_companies(bigin_id);
CREATE INDEX idx_crm_deals_bigin_id ON public.crm_deals(bigin_id);
CREATE INDEX idx_crm_notes_bigin_id ON public.crm_notes(bigin_id);
CREATE INDEX idx_crm_contacts_company_id ON public.crm_contacts(company_id);
CREATE INDEX idx_crm_deals_contact_id ON public.crm_deals(contact_id);
CREATE INDEX idx_crm_deals_company_id ON public.crm_deals(company_id);

-- Add triggers for updated_at
CREATE TRIGGER update_crm_contacts_updated_at
  BEFORE UPDATE ON public.crm_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_companies_updated_at
  BEFORE UPDATE ON public.crm_companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_deals_updated_at
  BEFORE UPDATE ON public.crm_deals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_notes_updated_at
  BEFORE UPDATE ON public.crm_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();