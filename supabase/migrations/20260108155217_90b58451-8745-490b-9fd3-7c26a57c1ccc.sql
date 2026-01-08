-- Funzione per normalizzare numeri di telefono (rimuove caratteri non numerici)
CREATE OR REPLACE FUNCTION normalize_phone(phone_number TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN REGEXP_REPLACE(COALESCE(phone_number, ''), '[^0-9]', '', 'g');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Crea un indice per velocizzare le ricerche sui numeri normalizzati
CREATE INDEX IF NOT EXISTS idx_leads_phone_normalized ON leads (normalize_phone(phone));