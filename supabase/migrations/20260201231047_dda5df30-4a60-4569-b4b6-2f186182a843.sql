-- Tabella per le campagne WhatsApp Automation
CREATE TABLE IF NOT EXISTS whatsapp_automation_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL DEFAULT 'opt_in', -- opt_in, lead_created, status_change
  target_pipeline TEXT, -- zapper, vesuviano, null = tutte
  whatsapp_account_id UUID REFERENCES whatsapp_accounts(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT false,
  require_opt_in BOOLEAN DEFAULT true, -- Richiede opt-in esplicito
  auto_select_language BOOLEAN DEFAULT true, -- AI seleziona lingua automaticamente
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Tabella per gli step delle campagne WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_automation_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES whatsapp_automation_campaigns(id) ON DELETE CASCADE NOT NULL,
  step_order INTEGER NOT NULL DEFAULT 1,
  template_id UUID REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  delay_days INTEGER DEFAULT 0,
  delay_hours INTEGER DEFAULT 0,
  delay_minutes INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabella per le esecuzioni WhatsApp automation
CREATE TABLE IF NOT EXISTS whatsapp_automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES whatsapp_automation_campaigns(id) ON DELETE CASCADE NOT NULL,
  step_id UUID REFERENCES whatsapp_automation_steps(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending', -- pending, sent, failed, cancelled
  error_message TEXT,
  selected_language TEXT, -- Lingua selezionata dall'AI
  template_used_id UUID REFERENCES whatsapp_templates(id),
  wamid TEXT, -- WhatsApp message ID
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabella per opt-in lead WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_opt_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  campaign_id UUID REFERENCES whatsapp_automation_campaigns(id) ON DELETE CASCADE,
  opted_in_at TIMESTAMPTZ DEFAULT now(),
  opted_out_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  source TEXT DEFAULT 'manual', -- manual, webhook, form
  UNIQUE(lead_id, campaign_id)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_wa_auto_exec_campaign ON whatsapp_automation_executions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_wa_auto_exec_lead ON whatsapp_automation_executions(lead_id);
CREATE INDEX IF NOT EXISTS idx_wa_auto_exec_status ON whatsapp_automation_executions(status);
CREATE INDEX IF NOT EXISTS idx_wa_auto_exec_scheduled ON whatsapp_automation_executions(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_wa_opt_ins_lead ON whatsapp_opt_ins(lead_id);

-- RLS
ALTER TABLE whatsapp_automation_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_automation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_opt_ins ENABLE ROW LEVEL SECURITY;

-- Policy per utenti autenticati
CREATE POLICY "Users can view whatsapp_automation_campaigns" ON whatsapp_automation_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage whatsapp_automation_campaigns" ON whatsapp_automation_campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view whatsapp_automation_steps" ON whatsapp_automation_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage whatsapp_automation_steps" ON whatsapp_automation_steps FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view whatsapp_automation_executions" ON whatsapp_automation_executions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage whatsapp_automation_executions" ON whatsapp_automation_executions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Users can view whatsapp_opt_ins" ON whatsapp_opt_ins FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage whatsapp_opt_ins" ON whatsapp_opt_ins FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger per updated_at
CREATE TRIGGER update_wa_automation_campaigns_updated_at
  BEFORE UPDATE ON whatsapp_automation_campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER update_wa_automation_steps_updated_at
  BEFORE UPDATE ON whatsapp_automation_steps
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();