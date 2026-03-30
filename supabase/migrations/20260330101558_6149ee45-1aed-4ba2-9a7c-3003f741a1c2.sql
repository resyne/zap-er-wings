
CREATE TABLE public.becca_followup_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  proposed_message TEXT NOT NULL,
  ai_reasoning TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'sent', 'edited')),
  followup_number INTEGER NOT NULL DEFAULT 1,
  days_inactive INTEGER NOT NULL DEFAULT 0,
  delay_days INTEGER NOT NULL DEFAULT 3,
  scheduled_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  sent_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  edited_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.becca_followup_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view followup queue" ON public.becca_followup_queue
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update followup queue" ON public.becca_followup_queue
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Service role can insert followup queue" ON public.becca_followup_queue
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_followup_queue_status ON public.becca_followup_queue(status);
CREATE INDEX idx_followup_queue_conversation ON public.becca_followup_queue(conversation_id);
CREATE INDEX idx_followup_queue_account ON public.becca_followup_queue(account_id);

CREATE TRIGGER set_followup_queue_updated_at
  BEFORE UPDATE ON public.becca_followup_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
