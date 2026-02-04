-- Aggiungi colonna per tracciare la lingua del template usato
ALTER TABLE whatsapp_messages 
ADD COLUMN template_language TEXT;

-- Commento per documentazione
COMMENT ON COLUMN whatsapp_messages.template_language IS 'Language code of the template used (e.g., en, it, es, fr, de, pt)';