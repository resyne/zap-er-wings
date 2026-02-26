
UPDATE public.whatsapp_templates
SET components = '[
  {
    "type": "BODY",
    "text": "Ciao {{1}},\n\nè stata inserita una nuova commessa:\n\n📋 *{{2}}*\n📌 Tipologia: {{3}}\n📅 Scadenza: {{4}}\n👤 Cliente: {{5}}\n\nControlla il gestionale per i dettagli."
  }
]'::jsonb
WHERE name = 'nuova_commessa_notifica'
  AND language = 'it'
  AND account_id = '907f2c19-ad44-4190-87ab-87dd1aa14dd1';
