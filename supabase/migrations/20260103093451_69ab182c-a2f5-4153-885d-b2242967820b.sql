-- Enum per IVA Mode
CREATE TYPE iva_mode AS ENUM (
  'DOMESTICA_IMPONIBILE',
  'CESSIONE_UE_NON_IMPONIBILE',
  'CESSIONE_EXTRA_UE_NON_IMPONIBILE',
  'VENDITA_RC_EDILE',
  'ACQUISTO_RC_EDILE'
);

-- Enum per tipo evento contabile
CREATE TYPE accounting_event_type AS ENUM (
  'COSTO',
  'RICAVO',
  'FINANZIARIO',
  'ASSESTAMENTO'
);

-- Enum per stato finanziario
CREATE TYPE financial_status_type AS ENUM (
  'DA_PAGARE',
  'DA_INCASSARE',
  'PAGATO',
  'INCASSATO',
  'ANTICIPO_DIPENDENTE',
  'RIMBORSO_DIPENDENTE'
);

-- Enum per competenza
CREATE TYPE competence_type AS ENUM (
  'IMMEDIATA',
  'RATEIZZATA',
  'DIFFERITA'
);

-- Enum per metodo pagamento
CREATE TYPE payment_method_type AS ENUM (
  'BANCA',
  'CASSA',
  'CARTA'
);

-- Tabella Regole Contabili
CREATE TABLE accounting_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id TEXT NOT NULL UNIQUE,
  tipo_evento accounting_event_type NOT NULL,
  incide_ce BOOLEAN NOT NULL,
  stato_finanziario financial_status_type,
  iva_mode iva_mode,
  output_template TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabella Template Righe Contabili
CREATE TABLE accounting_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabella Righe Template (1..N per template)
CREATE TABLE accounting_template_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES accounting_templates(id) ON DELETE CASCADE,
  line_order INTEGER NOT NULL,
  dare_conto_type TEXT NOT NULL, -- 'DYNAMIC' o codice conto fisso
  dare_conto_dynamic TEXT, -- es: 'BANCA_CASSA_CARTA', 'CREDITI_CLIENTI', 'CONTO_ECONOMICO'
  avere_conto_type TEXT NOT NULL,
  avere_conto_dynamic TEXT,
  importo_type TEXT NOT NULL, -- 'TOTALE', 'IMPONIBILE', 'IVA', 'IVA_CALCOLATA'
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabella Conti Patrimoniali Strutturali
CREATE TABLE structural_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL, -- 'PATRIMONIALE', 'ECONOMICO'
  category TEXT NOT NULL, -- 'BANCA', 'CASSA', 'CARTA', 'CREDITI_CLIENTI', 'DEBITI_FORNITORI', etc.
  is_structural BOOLEAN DEFAULT true,
  chart_account_id UUID REFERENCES chart_of_accounts(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE accounting_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_template_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE structural_accounts ENABLE ROW LEVEL SECURITY;

-- Policies (lettura per tutti gli utenti autenticati)
CREATE POLICY "Authenticated users can read accounting_rules" ON accounting_rules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read accounting_templates" ON accounting_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read accounting_template_lines" ON accounting_template_lines
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read structural_accounts" ON structural_accounts
  FOR SELECT TO authenticated USING (true);

-- Solo admin può modificare
CREATE POLICY "Admin can manage accounting_rules" ON accounting_rules
  FOR ALL TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());

CREATE POLICY "Admin can manage accounting_templates" ON accounting_templates
  FOR ALL TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());

CREATE POLICY "Admin can manage accounting_template_lines" ON accounting_template_lines
  FOR ALL TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());

CREATE POLICY "Admin can manage structural_accounts" ON structural_accounts
  FOR ALL TO authenticated USING (is_admin_user()) WITH CHECK (is_admin_user());

-- Inserimento dati iniziali: Templates
INSERT INTO accounting_templates (template_id, name, description) VALUES
('T_VENDITA_IMP', 'Vendita Imponibile', 'Template per vendite con IVA domestica'),
('T_ACQ_IMP', 'Acquisto Imponibile', 'Template per acquisti con IVA domestica'),
('T_VENDITA_NOIVA', 'Vendita senza IVA', 'Template per vendite UE/ExtraUE/RC'),
('T_ACQ_RC_EDILE', 'Acquisto Reverse Charge Edile', 'Template per acquisti con reverse charge'),
('T_INCASSO', 'Incasso', 'Template per incasso da cliente'),
('T_PAGAMENTO', 'Pagamento', 'Template per pagamento a fornitore'),
('T_ANTICIPO_DIP', 'Anticipo Dipendente', 'Template per spese anticipate da dipendente'),
('T_RIMBORSO_DIP', 'Rimborso Dipendente', 'Template per rimborso a dipendente');

-- Inserimento righe template
-- T_VENDITA_IMP
INSERT INTO accounting_template_lines (template_id, line_order, dare_conto_type, dare_conto_dynamic, avere_conto_type, avere_conto_dynamic, importo_type, note) VALUES
((SELECT id FROM accounting_templates WHERE template_id = 'T_VENDITA_IMP'), 1, 'DYNAMIC', 'BANCA_CASSA_CARTA_O_CREDITI', 'FIXED', NULL, 'TOTALE', 'Incasso o Credito = Totale'),
((SELECT id FROM accounting_templates WHERE template_id = 'T_VENDITA_IMP'), 2, 'FIXED', NULL, 'DYNAMIC', 'CONTO_ECONOMICO', 'IMPONIBILE', 'Ricavi = Imponibile'),
((SELECT id FROM accounting_templates WHERE template_id = 'T_VENDITA_IMP'), 3, 'FIXED', NULL, 'DYNAMIC', 'IVA_DEBITO', 'IVA', 'IVA Debito = IVA');

-- T_ACQ_IMP
INSERT INTO accounting_template_lines (template_id, line_order, dare_conto_type, dare_conto_dynamic, avere_conto_type, avere_conto_dynamic, importo_type, note) VALUES
((SELECT id FROM accounting_templates WHERE template_id = 'T_ACQ_IMP'), 1, 'DYNAMIC', 'CONTO_ECONOMICO', 'FIXED', NULL, 'IMPONIBILE', 'Costi = Imponibile'),
((SELECT id FROM accounting_templates WHERE template_id = 'T_ACQ_IMP'), 2, 'DYNAMIC', 'IVA_CREDITO', 'FIXED', NULL, 'IVA', 'IVA Credito = IVA'),
((SELECT id FROM accounting_templates WHERE template_id = 'T_ACQ_IMP'), 3, 'FIXED', NULL, 'DYNAMIC', 'BANCA_CASSA_CARTA_O_DEBITI', 'TOTALE', 'Pagamento o Debito = Totale');

-- T_VENDITA_NOIVA
INSERT INTO accounting_template_lines (template_id, line_order, dare_conto_type, dare_conto_dynamic, avere_conto_type, avere_conto_dynamic, importo_type, note) VALUES
((SELECT id FROM accounting_templates WHERE template_id = 'T_VENDITA_NOIVA'), 1, 'DYNAMIC', 'BANCA_CASSA_CARTA_O_CREDITI', 'FIXED', NULL, 'TOTALE', 'Incasso o Credito = Totale'),
((SELECT id FROM accounting_templates WHERE template_id = 'T_VENDITA_NOIVA'), 2, 'FIXED', NULL, 'DYNAMIC', 'CONTO_ECONOMICO', 'TOTALE', 'Ricavi = Totale');

-- T_ACQ_RC_EDILE
INSERT INTO accounting_template_lines (template_id, line_order, dare_conto_type, dare_conto_dynamic, avere_conto_type, avere_conto_dynamic, importo_type, note) VALUES
((SELECT id FROM accounting_templates WHERE template_id = 'T_ACQ_RC_EDILE'), 1, 'DYNAMIC', 'CONTO_ECONOMICO', 'FIXED', NULL, 'IMPONIBILE', 'Costi = Imponibile'),
((SELECT id FROM accounting_templates WHERE template_id = 'T_ACQ_RC_EDILE'), 2, 'FIXED', NULL, 'DYNAMIC', 'BANCA_CASSA_CARTA_O_DEBITI', 'IMPONIBILE', 'Pagamento o Debito = Imponibile'),
((SELECT id FROM accounting_templates WHERE template_id = 'T_ACQ_RC_EDILE'), 3, 'DYNAMIC', 'IVA_CREDITO', 'FIXED', NULL, 'IVA_CALCOLATA', 'IVA Credito (RC)'),
((SELECT id FROM accounting_templates WHERE template_id = 'T_ACQ_RC_EDILE'), 4, 'FIXED', NULL, 'DYNAMIC', 'IVA_DEBITO', 'IVA_CALCOLATA', 'IVA Debito (RC)');

-- T_INCASSO
INSERT INTO accounting_template_lines (template_id, line_order, dare_conto_type, dare_conto_dynamic, avere_conto_type, avere_conto_dynamic, importo_type, note) VALUES
((SELECT id FROM accounting_templates WHERE template_id = 'T_INCASSO'), 1, 'DYNAMIC', 'BANCA_CASSA_CARTA', 'DYNAMIC', 'CREDITI_CLIENTI', 'TOTALE', 'Incasso da Crediti');

-- T_PAGAMENTO
INSERT INTO accounting_template_lines (template_id, line_order, dare_conto_type, dare_conto_dynamic, avere_conto_type, avere_conto_dynamic, importo_type, note) VALUES
((SELECT id FROM accounting_templates WHERE template_id = 'T_PAGAMENTO'), 1, 'DYNAMIC', 'DEBITI_FORNITORI', 'DYNAMIC', 'BANCA_CASSA_CARTA', 'TOTALE', 'Pagamento Debiti');

-- T_ANTICIPO_DIP
INSERT INTO accounting_template_lines (template_id, line_order, dare_conto_type, dare_conto_dynamic, avere_conto_type, avere_conto_dynamic, importo_type, note) VALUES
((SELECT id FROM accounting_templates WHERE template_id = 'T_ANTICIPO_DIP'), 1, 'DYNAMIC', 'CONTO_ECONOMICO', 'DYNAMIC', 'DEBITI_DIPENDENTI', 'TOTALE', 'Costo anticipato da dipendente');

-- T_RIMBORSO_DIP
INSERT INTO accounting_template_lines (template_id, line_order, dare_conto_type, dare_conto_dynamic, avere_conto_type, avere_conto_dynamic, importo_type, note) VALUES
((SELECT id FROM accounting_templates WHERE template_id = 'T_RIMBORSO_DIP'), 1, 'DYNAMIC', 'DEBITI_DIPENDENTI', 'DYNAMIC', 'BANCA_CASSA_CARTA', 'TOTALE', 'Rimborso a dipendente');

-- Inserimento Regole Contabili
INSERT INTO accounting_rules (rule_id, tipo_evento, incide_ce, stato_finanziario, iva_mode, output_template, description, priority) VALUES
('R1', 'RICAVO', true, 'DA_INCASSARE', 'DOMESTICA_IMPONIBILE', 'T_VENDITA_IMP', 'Vendita imponibile da incassare', 10),
('R2', 'RICAVO', true, 'INCASSATO', 'DOMESTICA_IMPONIBILE', 'T_VENDITA_IMP', 'Vendita imponibile incassata', 10),
('R3', 'COSTO', true, 'DA_PAGARE', 'DOMESTICA_IMPONIBILE', 'T_ACQ_IMP', 'Acquisto imponibile da pagare', 10),
('R4', 'COSTO', true, 'PAGATO', 'DOMESTICA_IMPONIBILE', 'T_ACQ_IMP', 'Acquisto imponibile pagato', 10),
('R5', 'RICAVO', true, 'DA_INCASSARE', 'CESSIONE_UE_NON_IMPONIBILE', 'T_VENDITA_NOIVA', 'Cessione intracomunitaria', 10),
('R6', 'RICAVO', true, 'DA_INCASSARE', 'CESSIONE_EXTRA_UE_NON_IMPONIBILE', 'T_VENDITA_NOIVA', 'Esportazione extra UE', 10),
('R7', 'RICAVO', true, 'DA_INCASSARE', 'VENDITA_RC_EDILE', 'T_VENDITA_NOIVA', 'Vendita reverse charge edile', 10),
('R8', 'COSTO', true, 'DA_PAGARE', 'ACQUISTO_RC_EDILE', 'T_ACQ_RC_EDILE', 'Acquisto reverse charge edile', 10),
('R9', 'FINANZIARIO', false, 'INCASSATO', NULL, 'T_INCASSO', 'Incasso credito cliente', 20),
('R10', 'FINANZIARIO', false, 'PAGATO', NULL, 'T_PAGAMENTO', 'Pagamento debito fornitore', 20),
('R11', 'COSTO', true, 'ANTICIPO_DIPENDENTE', NULL, 'T_ANTICIPO_DIP', 'Spesa anticipata da dipendente', 15),
('R12', 'FINANZIARIO', false, 'RIMBORSO_DIPENDENTE', NULL, 'T_RIMBORSO_DIP', 'Rimborso a dipendente', 20);

-- Inserimento Conti Strutturali
INSERT INTO structural_accounts (code, name, account_type, category) VALUES
('BANCA', 'Banca c/c', 'PATRIMONIALE', 'BANCA'),
('CASSA', 'Cassa contanti', 'PATRIMONIALE', 'CASSA'),
('CARTA', 'Carta di credito', 'PATRIMONIALE', 'CARTA'),
('CREDITI_CLIENTI', 'Crediti verso clienti', 'PATRIMONIALE', 'CREDITI_CLIENTI'),
('DEBITI_FORNITORI', 'Debiti verso fornitori', 'PATRIMONIALE', 'DEBITI_FORNITORI'),
('DEBITI_DIPENDENTI', 'Debiti verso dipendenti', 'PATRIMONIALE', 'DEBITI_DIPENDENTI'),
('IVA_DEBITO', 'IVA a debito', 'PATRIMONIALE', 'IVA_DEBITO'),
('IVA_CREDITO', 'IVA a credito', 'PATRIMONIALE', 'IVA_CREDITO');

-- Trigger per updated_at
CREATE TRIGGER set_accounting_rules_updated_at
  BEFORE UPDATE ON accounting_rules
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_accounting_templates_updated_at
  BEFORE UPDATE ON accounting_templates
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_structural_accounts_updated_at
  BEFORE UPDATE ON structural_accounts
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();