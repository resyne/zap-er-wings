
-- Insert 4 language variants of becca_followup template for Vesuviano account
INSERT INTO public.whatsapp_templates (account_id, name, language, category, status, components)
VALUES 
  ('9d24956a-d020-485e-9c5b-8cce3e224508', 'becca_followup', 'it', 'MARKETING', 'DRAFT', 
   '[{"type": "BODY", "text": "Ciao {{1}}, come stai? Volevamo sapere se hai ancora interesse per i nostri forni. Siamo a disposizione per qualsiasi domanda!"}]'::jsonb),
  ('9d24956a-d020-485e-9c5b-8cce3e224508', 'becca_followup', 'en', 'MARKETING', 'DRAFT', 
   '[{"type": "BODY", "text": "Hi {{1}}, how are you? We wanted to check if you are still interested in our ovens. We are happy to help with any questions!"}]'::jsonb),
  ('9d24956a-d020-485e-9c5b-8cce3e224508', 'becca_followup', 'es', 'MARKETING', 'DRAFT', 
   '[{"type": "BODY", "text": "Hola {{1}}, ¿cómo estás? Queríamos saber si todavía tienes interés en nuestros hornos. ¡Estamos a tu disposición para cualquier pregunta!"}]'::jsonb),
  ('9d24956a-d020-485e-9c5b-8cce3e224508', 'becca_followup', 'fr', 'MARKETING', 'DRAFT', 
   '[{"type": "BODY", "text": "Bonjour {{1}}, comment allez-vous? Nous voulions savoir si vous êtes toujours intéressé par nos fours. Nous sommes à votre disposition pour toute question!"}]'::jsonb);
