
-- Insert the WhatsApp template for new commessa notification (Zapper account)
INSERT INTO public.whatsapp_templates (
  account_id,
  name,
  language,
  category,
  status,
  components
) VALUES (
  '907f2c19-ad44-4190-87ab-87dd1aa14dd1',
  'nuova_commessa_notifica',
  'it',
  'UTILITY',
  'DRAFT',
  '[
    {
      "type": "BODY",
      "text": "Ciao {{1}},\n\nÈ stata inserita una nuova commessa:\n\n📋 *{{2}}*\n📌 Tipologia: {{3}}\n📅 Scadenza: {{4}}\n👤 Cliente: {{5}}."
    }
  ]'::jsonb
);
