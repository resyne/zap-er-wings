
INSERT INTO whatsapp_templates (account_id, name, language, category, status, components) VALUES
('907f2c19-ad44-4190-87ab-87dd1aa14dd1', 'data_calendarizzata', 'it', 'UTILITY', 'DRAFT', '[{"type":"BODY","text":"Ciao {{1}},\n\nla commessa *{{2}}* - fase *{{3}}* è stata calendarizzata per il {{4}}.\n\n👤 Cliente: {{5}}.\n\nControlla il gestionale per i dettagli."}]'::jsonb),
('907f2c19-ad44-4190-87ab-87dd1aa14dd1', 'data_ricalendarizzata', 'it', 'UTILITY', 'DRAFT', '[{"type":"BODY","text":"Ciao {{1}},\n\nla data della commessa *{{2}}* - fase *{{3}}* è stata modificata al {{4}}.\n\n👤 Cliente: {{5}}.\n\nControlla il gestionale per i dettagli."}]'::jsonb);
