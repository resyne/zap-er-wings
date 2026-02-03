-- Update Spanish (ES) template with correct translation
UPDATE public.whatsapp_templates 
SET components = '[{"type": "BODY", "text": "Hola {{1}} 😊\n\nPerfecto, gracias por tu respuesta.\nPara configurar el nuevo horno según tus necesidades, puedes usar el siguiente enlace:\n\n👉 {{2}}\n\nAlternativamente, si prefieres, podemos hablar directamente por teléfono.", "example": {"body_text": [["Mario Rossi", "email@example.com"]]}}, {"type": "BUTTONS", "buttons": [{"type": "QUICK_REPLY", "text": "Prefiero una llamada"}]}]'::jsonb
WHERE id = 'fe0b5a1a-20b4-4700-ad1d-8be4ede43390';

-- Update French (FR) template with correct translation
UPDATE public.whatsapp_templates 
SET components = '[{"type": "BODY", "text": "Bonjour {{1}} 😊\n\nParfait, merci pour votre réponse.\nPour configurer le nouveau four selon vos besoins, vous pouvez utiliser le lien ci-dessous :\n\n👉 {{2}}\n\nAlternativement, si vous préférez, nous pouvons nous appeler directement.", "example": {"body_text": [["Mario Rossi", "email@example.com"]]}}, {"type": "BUTTONS", "buttons": [{"type": "QUICK_REPLY", "text": "Je préfère un appel"}]}]'::jsonb
WHERE id = '7de0ea4c-2f95-40c9-8360-d4585c9d46cf';