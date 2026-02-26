
-- Insert DRAFT templates for cambio_priorita_commessa and comunicazione_urgente_commessa (Zapper account)
INSERT INTO public.whatsapp_templates (account_id, name, language, category, status, components)
VALUES
  ('907f2c19-ad44-4190-87ab-87dd1aa14dd1', 'cambio_priorita_commessa', 'it', 'UTILITY', 'DRAFT',
   '[{"type":"BODY","text":"Ciao {{1}}, la priorità della commessa {{2}} è cambiata da {{3}} a {{4}}.\nTipo: {{5}}\nCliente: {{6}}\nScadenza: {{7}}.\nControlla il gestionale per i dettagli."}]'::jsonb),
  ('907f2c19-ad44-4190-87ab-87dd1aa14dd1', 'comunicazione_urgente_commessa', 'it', 'UTILITY', 'DRAFT',
   '[{"type":"BODY","text":"Ciao {{1}}, comunicazione urgente per la commessa {{2}} ({{3}}):\n\n{{4}}\n\nCliente: {{5}}.\nControlla il gestionale per i dettagli."}]'::jsonb);
