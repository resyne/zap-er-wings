
-- Becca AI Assistant: authorized users and activity log

-- Table for authorized Becca users (team members who can use Becca via WhatsApp)
CREATE TABLE public.becca_authorized_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    phone_number TEXT NOT NULL,
    display_name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    allowed_actions TEXT[] NOT NULL DEFAULT ARRAY['prima_nota', 'task', 'sales_order', 'lead'],
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(account_id, phone_number)
);

-- Activity log for all Becca actions
CREATE TABLE public.becca_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
    authorized_user_id UUID REFERENCES public.becca_authorized_users(id) ON DELETE SET NULL,
    conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
    message_id TEXT,
    action_type TEXT NOT NULL, -- prima_nota, task, sales_order, lead, unknown, error
    intent_detected TEXT, -- raw intent classification
    raw_message TEXT,
    ai_interpretation JSONB,
    entity_id UUID, -- ID of created entity (accounting_entry, task, sales_order, lead)
    entity_type TEXT, -- accounting_entries, tasks, sales_orders, leads
    status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, failed, awaiting_confirmation
    error_message TEXT,
    confidence_score INTEGER, -- 0-100
    confirmation_question TEXT, -- question sent back to user
    user_confirmed BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Becca settings per account
CREATE TABLE public.becca_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE UNIQUE,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    ai_persona TEXT DEFAULT 'Sei Becca, l''assistente AI aziendale di Zapper. Sei efficiente, precisa e professionale. Rispondi sempre in italiano.',
    default_task_assignee UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    auto_confirm_threshold INTEGER DEFAULT 90, -- confidence above this = auto-execute
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.becca_authorized_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.becca_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.becca_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies (authenticated users can manage)
CREATE POLICY "Authenticated users can manage becca_authorized_users" ON public.becca_authorized_users FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can view becca_activity_log" ON public.becca_activity_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage becca_settings" ON public.becca_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Service role needs access for edge functions
CREATE POLICY "Service role access becca_authorized_users" ON public.becca_authorized_users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role access becca_activity_log" ON public.becca_activity_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role access becca_settings" ON public.becca_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
