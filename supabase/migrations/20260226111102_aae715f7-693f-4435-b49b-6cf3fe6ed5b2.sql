
-- Insert the WhatsApp template for commessa status change notification (Zapper account)
INSERT INTO public.whatsapp_templates (
  account_id,
  name,
  language,
  category,
  status,
  components
) VALUES (
  '907f2c19-ad44-4190-87ab-87dd1aa14dd1',
  'cambio_stato_commessa',
  'it',
  'UTILITY',
  'DRAFT',
  '[
    {
      "type": "BODY",
      "text": "Ciao {{1}},\n\nLa commessa *{{2}}* ha cambiato stato:\n\n🔄 Nuovo stato: *{{3}}*\n📌 Tipologia: {{4}}\n👤 Cliente: {{5}}\n📅 Scadenza: {{6}}.\n\nControlla il gestionale per i dettagli."
    }
  ]'::jsonb
);
