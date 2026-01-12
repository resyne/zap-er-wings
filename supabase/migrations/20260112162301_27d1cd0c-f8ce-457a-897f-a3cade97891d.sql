-- Add wasender_contacts table for contact management
CREATE TABLE public.wasender_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.wasender_accounts(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(account_id, phone)
);

-- Add api_key and webhook_secret columns to wasender_accounts
ALTER TABLE public.wasender_accounts 
ADD COLUMN IF NOT EXISTS api_key TEXT,
ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

-- Enable RLS
ALTER TABLE public.wasender_contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies for wasender_contacts
CREATE POLICY "Users can view wasender contacts" ON public.wasender_contacts
FOR SELECT USING (true);

CREATE POLICY "Users can create wasender contacts" ON public.wasender_contacts
FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update wasender contacts" ON public.wasender_contacts
FOR UPDATE USING (true);

CREATE POLICY "Users can delete wasender contacts" ON public.wasender_contacts
FOR DELETE USING (true);

-- Index for faster lookups
CREATE INDEX idx_wasender_contacts_account ON public.wasender_contacts(account_id);
CREATE INDEX idx_wasender_contacts_phone ON public.wasender_contacts(phone);