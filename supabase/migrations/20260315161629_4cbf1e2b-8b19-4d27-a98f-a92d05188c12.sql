
-- Config table for WhatsApp Prima Nota integration
CREATE TABLE public.whatsapp_prima_nota_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE NOT NULL,
  authorized_phone TEXT NOT NULL,
  user_label TEXT NOT NULL DEFAULT 'Prima Nota',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(account_id, authorized_phone)
);

-- Log table for processed entries
CREATE TABLE public.whatsapp_prima_nota_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES public.whatsapp_prima_nota_config(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  accounting_entry_id UUID REFERENCES public.accounting_entries(id) ON DELETE SET NULL,
  raw_message TEXT,
  ai_interpretation JSON,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_prima_nota_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_prima_nota_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage prima nota config" ON public.whatsapp_prima_nota_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view prima nota log" ON public.whatsapp_prima_nota_log
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
