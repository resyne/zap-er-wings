-- Create WaSender accounts table
CREATE TABLE public.wasender_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_unit_id UUID NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  account_name TEXT,
  status TEXT DEFAULT 'active',
  credits_balance NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create WaSender conversations table
CREATE TABLE public.wasender_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.wasender_accounts(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  customer_id UUID REFERENCES public.customers(id),
  lead_id UUID REFERENCES public.leads(id),
  last_message_at TIMESTAMP WITH TIME ZONE,
  last_message_preview TEXT,
  unread_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create WaSender messages table
CREATE TABLE public.wasender_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.wasender_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT DEFAULT 'text',
  content TEXT,
  media_url TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create WaSender credit transactions table
CREATE TABLE public.wasender_credit_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.wasender_accounts(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  transaction_type TEXT NOT NULL,
  balance_after NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wasender_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wasender_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wasender_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wasender_credit_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for wasender_accounts
CREATE POLICY "Authenticated users can view wasender accounts"
ON public.wasender_accounts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create wasender accounts"
ON public.wasender_accounts FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update wasender accounts"
ON public.wasender_accounts FOR UPDATE
TO authenticated
USING (true);

-- Create RLS policies for wasender_conversations
CREATE POLICY "Authenticated users can view wasender conversations"
ON public.wasender_conversations FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create wasender conversations"
ON public.wasender_conversations FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update wasender conversations"
ON public.wasender_conversations FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete wasender conversations"
ON public.wasender_conversations FOR DELETE
TO authenticated
USING (true);

-- Create RLS policies for wasender_messages
CREATE POLICY "Authenticated users can view wasender messages"
ON public.wasender_messages FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create wasender messages"
ON public.wasender_messages FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update wasender messages"
ON public.wasender_messages FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete wasender messages"
ON public.wasender_messages FOR DELETE
TO authenticated
USING (true);

-- Create RLS policies for wasender_credit_transactions
CREATE POLICY "Authenticated users can view wasender credit transactions"
ON public.wasender_credit_transactions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create wasender credit transactions"
ON public.wasender_credit_transactions FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_wasender_accounts_business_unit ON public.wasender_accounts(business_unit_id);
CREATE INDEX idx_wasender_conversations_account ON public.wasender_conversations(account_id);
CREATE INDEX idx_wasender_conversations_customer_phone ON public.wasender_conversations(customer_phone);
CREATE INDEX idx_wasender_messages_conversation ON public.wasender_messages(conversation_id);
CREATE INDEX idx_wasender_credit_transactions_account ON public.wasender_credit_transactions(account_id);