-- Rimuovi tutti i riferimenti ai conti esistenti in tutte le tabelle collegate
UPDATE accounting_entries SET chart_account_id = NULL WHERE chart_account_id IS NOT NULL;
UPDATE prima_nota SET chart_account_id = NULL WHERE chart_account_id IS NOT NULL;
DELETE FROM prima_nota_lines;
DELETE FROM gl_entry_line;
DELETE FROM budget;
DELETE FROM journal_entries;

-- Elimina tutti i conti esistenti
DELETE FROM chart_of_accounts;

-- ============================================
-- CONTO ECONOMICO
-- ============================================

INSERT INTO chart_of_accounts (code, name, account_type, level, is_header, parent_code, is_active, visibility)
VALUES 
  ('01', 'Ricavi', 'revenue', 1, true, NULL, true, 'reporting'),
  ('01.01', 'Ricavi Vendita Macchinari', 'revenue', 2, false, '01', true, 'classificazione'),
  ('01.02', 'Ricavi Installazioni', 'revenue', 2, false, '01', true, 'classificazione'),
  ('01.03', 'Ricavi Manutenzione', 'revenue', 2, false, '01', true, 'classificazione'),
  ('01.90', 'Resi e Sconti su Vendite (contra-ricavo)', 'revenue', 2, false, '01', true, 'classificazione'),
  ('02', 'Costo del Venduto (COGS)', 'cogs', 1, true, NULL, true, 'reporting'),
  ('02.01', 'Materiali & Componenti', 'cogs', 2, false, '02', true, 'classificazione'),
  ('02.02', 'Manodopera Diretta (ore tecnico)', 'cogs', 2, false, '02', true, 'classificazione'),
  ('02.03', 'Trasporti & Logistica', 'cogs', 2, false, '02', true, 'classificazione'),
  ('02.99', 'Altri COGS (conto tampone)', 'cogs', 2, false, '02', true, 'classificazione'),
  ('03', 'Costi Operativi (OPEX)', 'opex', 1, true, NULL, true, 'reporting'),
  ('03.10', 'Personale (non diretto)', 'opex', 2, false, '03', true, 'classificazione'),
  ('03.20', 'Marketing & Advertising', 'opex', 2, false, '03', true, 'classificazione'),
  ('03.30', 'Software & Cloud', 'opex', 2, false, '03', true, 'classificazione'),
  ('03.40', 'Affitti & Utenze', 'opex', 2, false, '03', true, 'classificazione'),
  ('03.50', 'Consulenze & Servizi Esterni', 'opex', 2, false, '03', true, 'classificazione'),
  ('03.99', 'Altri OPEX', 'opex', 2, false, '03', true, 'classificazione'),
  ('07', 'Ammortamenti', 'depreciation', 1, true, NULL, true, 'reporting'),
  ('07.10', 'Ammortamenti Immobilizzazioni', 'depreciation', 2, false, '07', true, 'classificazione'),
  ('09', 'Proventi e Oneri Straordinari', 'extraordinary', 1, true, NULL, true, 'reporting'),
  ('09.10', 'Costi Straordinari / One-off', 'extraordinary', 2, false, '09', true, 'classificazione'),
  ('09.20', 'Proventi Straordinari', 'extraordinary', 2, false, '09', true, 'classificazione'),
  ('10', 'Attività', 'asset', 1, true, NULL, true, 'reporting'),
  ('10.1', 'Disponibilità Liquide', 'asset', 2, true, '10', true, 'reporting'),
  ('10.10', 'Banca c/c', 'asset', 3, false, '10.1', true, 'classificazione'),
  ('10.11', 'Cassa', 'asset', 3, false, '10.1', true, 'classificazione'),
  ('10.12', 'Carte Aziendali', 'asset', 3, false, '10.1', true, 'classificazione'),
  ('10.13', 'Conti Online / Gateway (PayPal, Stripe, ecc.)', 'asset', 3, false, '10.1', true, 'classificazione'),
  ('10.2', 'Crediti', 'asset', 2, true, '10', true, 'reporting'),
  ('10.20', 'Crediti verso Clienti', 'asset', 3, false, '10.2', true, 'classificazione'),
  ('10.21', 'Anticipi a Fornitori', 'asset', 3, false, '10.2', true, 'classificazione'),
  ('10.3', 'IVA', 'asset', 2, true, '10', true, 'reporting'),
  ('10.30', 'IVA a Credito', 'asset', 3, false, '10.3', true, 'classificazione'),
  ('10.4', 'Rimanenze', 'asset', 2, true, '10', true, 'reporting'),
  ('10.40', 'Rimanenze di Magazzino', 'asset', 3, false, '10.4', true, 'classificazione'),
  ('20', 'Passività', 'liability', 1, true, NULL, true, 'reporting'),
  ('20.1', 'Debiti', 'liability', 2, true, '20', true, 'reporting'),
  ('20.10', 'Debiti verso Fornitori', 'liability', 3, false, '20.1', true, 'classificazione'),
  ('20.11', 'Debiti verso Dipendenti', 'liability', 3, false, '20.1', true, 'classificazione'),
  ('20.12', 'Debiti Tributari', 'liability', 3, false, '20.1', true, 'classificazione'),
  ('20.2', 'IVA', 'liability', 2, true, '20', true, 'reporting'),
  ('20.20', 'IVA a Debito', 'liability', 3, false, '20.2', true, 'classificazione'),
  ('20.3', 'Anticipi', 'liability', 2, true, '20', true, 'reporting'),
  ('20.30', 'Anticipi da Clienti', 'liability', 3, false, '20.3', true, 'classificazione'),
  ('30', 'Patrimonio Netto', 'equity', 1, true, NULL, true, 'reporting'),
  ('30.10', 'Capitale Sociale', 'equity', 2, false, '30', true, 'classificazione'),
  ('30.20', 'Utili / Perdite Portati a Nuovo', 'equity', 2, false, '30', true, 'classificazione'),
  ('30.30', 'Utile / Perdita d''Esercizio', 'equity', 2, false, '30', true, 'classificazione'),
  ('90', 'Conti Tecnici di Sistema', 'system', 1, true, NULL, true, 'assestamenti'),
  ('90.10', 'Conto Transitorio', 'system', 2, false, '90', true, 'assestamenti'),
  ('90.20', 'Conto di Chiusura Esercizio', 'system', 2, false, '90', true, 'assestamenti');