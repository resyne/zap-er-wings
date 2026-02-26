-- Insert WhatsApp templates for the 4 missing notification event types
-- These are DRAFT templates that need to be submitted to Meta for approval

-- 1. nuovo_ordine (Nuovo Ordine di Vendita)
INSERT INTO public.whatsapp_templates (account_id, name, language, category, status, components)
VALUES (
  '907f2c19-ad44-4190-87ab-87dd1aa14dd1',
  'nuovo_ordine_vendita',
  'it',
  'UTILITY',
  'DRAFT',
  '[{"type":"BODY","text":"Ciao {{1}},\n\nè stato inserito un nuovo ordine di vendita:\n\n🛒 *{{2}}*\n👤 Cliente: {{3}}\n💰 Importo: {{4}}\n📅 Data: {{5}}\n\nControlla il gestionale per i dettagli."}]'::jsonb
);

-- 2. nuovo_ordine_acquisto (Nuovo Ordine di Acquisto)
INSERT INTO public.whatsapp_templates (account_id, name, language, category, status, components)
VALUES (
  '907f2c19-ad44-4190-87ab-87dd1aa14dd1',
  'nuovo_ordine_acquisto',
  'it',
  'UTILITY',
  'DRAFT',
  '[{"type":"BODY","text":"Ciao {{1}},\n\nè stato inserito un nuovo ordine di acquisto:\n\n📦 *{{2}}*\n🏭 Fornitore: {{3}}\n💰 Importo: {{4}}\n📅 Data: {{5}}\n\nControlla il gestionale per i dettagli."}]'::jsonb
);

-- 3. cambio_stato_ordine_acquisto (Cambio Stato Ordine Acquisto)
INSERT INTO public.whatsapp_templates (account_id, name, language, category, status, components)
VALUES (
  '907f2c19-ad44-4190-87ab-87dd1aa14dd1',
  'cambio_stato_ordine_acquisto',
  'it',
  'UTILITY',
  'DRAFT',
  '[{"type":"BODY","text":"Ciao {{1}},\n\nlo stato dell''ordine di acquisto è cambiato:\n\n📦 *{{2}}*\n🔄 Nuovo stato: {{3}}\n🏭 Fornitore: {{4}}\n📅 Data: {{5}}\n\nControlla il gestionale per i dettagli."}]'::jsonb
);

-- 4. scadenza_imminente (Scadenza Imminente)
INSERT INTO public.whatsapp_templates (account_id, name, language, category, status, components)
VALUES (
  '907f2c19-ad44-4190-87ab-87dd1aa14dd1',
  'scadenza_imminente',
  'it',
  'UTILITY',
  'DRAFT',
  '[{"type":"BODY","text":"Ciao {{1}},\n\n⚠️ La commessa seguente ha una scadenza imminente:\n\n📋 *{{2}}*\n📌 Tipologia: {{3}}\n👤 Cliente: {{4}}\n📅 Scadenza: {{5}}\n⏰ Giorni rimasti: {{6}}\n\nVerifica lo stato sul gestionale."}]'::jsonb
);