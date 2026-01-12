-- WhatsApp Business Accounts (per Business Unit)
CREATE TABLE public.whatsapp_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_unit_id UUID REFERENCES public.business_units(id) ON DELETE CASCADE,
  phone_number_id TEXT NOT NULL,
  display_phone_number TEXT NOT NULL,
  waba_id TEXT NOT NULL, -- WhatsApp Business Account ID
  access_token TEXT, -- Meta access token (encrypted at rest)
  verified_name TEXT,
  quality_rating TEXT,
  messaging_limit TEXT,
  status TEXT DEFAULT 'active',
  credits_balance DECIMAL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- WhatsApp Message Templates
CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  template_id TEXT, -- ID from Meta
  name TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'it',
  category TEXT NOT NULL, -- MARKETING, UTILITY, AUTHENTICATION
  status TEXT DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
  components JSONB, -- Header, Body, Footer, Buttons
  example_values JSONB,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- WhatsApp Conversations (chat threads)
CREATE TABLE public.whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  customer_id UUID REFERENCES public.customers(id),
  lead_id UUID REFERENCES public.leads(id),
  last_message_at TIMESTAMP WITH TIME ZONE,
  last_message_preview TEXT,
  unread_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open', -- open, closed, archived
  conversation_type TEXT, -- user_initiated, business_initiated
  expires_at TIMESTAMP WITH TIME ZONE, -- 24h window for free-form messaging
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(account_id, customer_phone)
);

-- WhatsApp Messages
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  wamid TEXT, -- WhatsApp message ID
  direction TEXT NOT NULL, -- inbound, outbound
  message_type TEXT NOT NULL, -- text, image, video, audio, document, template, interactive, location, contacts, sticker, reaction
  content TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  template_name TEXT,
  template_params JSONB,
  interactive_data JSONB,
  status TEXT DEFAULT 'sent', -- sent, delivered, read, failed
  error_code TEXT,
  error_message TEXT,
  sent_by UUID, -- user who sent the message (for outbound)
  read_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- WhatsApp Credit Transactions
CREATE TABLE public.whatsapp_credit_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  amount DECIMAL NOT NULL,
  transaction_type TEXT NOT NULL, -- topup, message_sent, refund
  conversation_type TEXT, -- marketing, utility, authentication, service
  message_id UUID REFERENCES public.whatsapp_messages(id),
  balance_after DECIMAL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whatsapp_accounts
CREATE POLICY "Authenticated users can view WhatsApp accounts"
  ON public.whatsapp_accounts FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage WhatsApp accounts"
  ON public.whatsapp_accounts FOR ALL
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- RLS Policies for whatsapp_templates
CREATE POLICY "Authenticated users can view WhatsApp templates"
  ON public.whatsapp_templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage WhatsApp templates"
  ON public.whatsapp_templates FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for whatsapp_conversations
CREATE POLICY "Authenticated users can view WhatsApp conversations"
  ON public.whatsapp_conversations FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage WhatsApp conversations"
  ON public.whatsapp_conversations FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for whatsapp_messages
CREATE POLICY "Authenticated users can view WhatsApp messages"
  ON public.whatsapp_messages FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create WhatsApp messages"
  ON public.whatsapp_messages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for whatsapp_credit_transactions
CREATE POLICY "Authenticated users can view WhatsApp credit transactions"
  ON public.whatsapp_credit_transactions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage WhatsApp credit transactions"
  ON public.whatsapp_credit_transactions FOR ALL
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- Indexes for performance
CREATE INDEX idx_whatsapp_conversations_account ON public.whatsapp_conversations(account_id);
CREATE INDEX idx_whatsapp_conversations_customer_phone ON public.whatsapp_conversations(customer_phone);
CREATE INDEX idx_whatsapp_messages_conversation ON public.whatsapp_messages(conversation_id);
CREATE INDEX idx_whatsapp_messages_wamid ON public.whatsapp_messages(wamid);
CREATE INDEX idx_whatsapp_templates_account ON public.whatsapp_templates(account_id);

-- Update timestamp trigger
CREATE TRIGGER update_whatsapp_accounts_updated_at
  BEFORE UPDATE ON public.whatsapp_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_conversations_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();