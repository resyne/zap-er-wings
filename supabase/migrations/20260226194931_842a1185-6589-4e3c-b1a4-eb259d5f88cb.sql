
-- Add WhatsApp notification option to notification settings
ALTER TABLE public.whatsapp_notification_settings 
ADD COLUMN IF NOT EXISTS whatsapp_when_offline boolean DEFAULT false;

-- Insert notification templates for both accounts
INSERT INTO public.whatsapp_templates (account_id, name, language, category, status, components)
VALUES 
  -- Zapper account - Italian
  ('907f2c19-ad44-4190-87ab-87dd1aa14dd1', 'nuovo_messaggio_chat', 'it', 'UTILITY', 'DRAFT', 
   '[{"type": "BODY", "text": "Ciao {{1}},\n\nHai ricevuto un nuovo messaggio WhatsApp da *{{2}}* ({{3}}):\n\n\"{{4}}\"\n\nAccedi al gestionale per rispondere."}]'::jsonb),
  -- Zapper account - English
  ('907f2c19-ad44-4190-87ab-87dd1aa14dd1', 'nuovo_messaggio_chat', 'en', 'UTILITY', 'DRAFT',
   '[{"type": "BODY", "text": "Hi {{1}},\n\nYou received a new WhatsApp message from *{{2}}* ({{3}}):\n\n\"{{4}}\"\n\nLog in to the management system to reply."}]'::jsonb),
  -- Vesuviano account - Italian
  ('9d24956a-d020-485e-9c5b-8cce3e224508', 'nuovo_messaggio_chat', 'it', 'UTILITY', 'DRAFT',
   '[{"type": "BODY", "text": "Ciao {{1}},\n\nHai ricevuto un nuovo messaggio WhatsApp da *{{2}}* ({{3}}):\n\n\"{{4}}\"\n\nAccedi al gestionale per rispondere."}]'::jsonb),
  -- Vesuviano account - English
  ('9d24956a-d020-485e-9c5b-8cce3e224508', 'nuovo_messaggio_chat', 'en', 'UTILITY', 'DRAFT',
   '[{"type": "BODY", "text": "Hi {{1}},\n\nYou received a new WhatsApp message from *{{2}}* ({{3}}):\n\n\"{{4}}\"\n\nLog in to the management system to reply."}]'::jsonb)
ON CONFLICT (account_id, name, language) DO NOTHING;
