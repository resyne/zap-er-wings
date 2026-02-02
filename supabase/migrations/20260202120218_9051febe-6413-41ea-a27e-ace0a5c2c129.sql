
-- Aggiorna la funzione per SEMPRE forzare la nazione basata sul prefisso telefonico
CREATE OR REPLACE FUNCTION auto_set_lead_country()
RETURNS TRIGGER AS $$
DECLARE
  detected_country TEXT;
BEGIN
  -- Rileva sempre la nazione dal telefono se presente
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    detected_country := detect_country_from_phone(NEW.phone);
    
    -- Se rilevata una nazione dal prefisso, FORZA sempre il valore corretto
    IF detected_country IS NOT NULL THEN
      NEW.country := detected_country;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Correggi retroattivamente tutti i lead con nazione errata basandosi sul prefisso
UPDATE leads SET country = 'Spagna' WHERE phone LIKE '+34%' AND (country IS NULL OR country != 'Spagna');
UPDATE leads SET country = 'Francia' WHERE phone LIKE '+33%' AND (country IS NULL OR country != 'Francia');
UPDATE leads SET country = 'Germania' WHERE phone LIKE '+49%' AND (country IS NULL OR country != 'Germania');
UPDATE leads SET country = 'UK' WHERE phone LIKE '+44%' AND (country IS NULL OR country != 'UK');
UPDATE leads SET country = 'Portogallo' WHERE phone LIKE '+351%' AND (country IS NULL OR country != 'Portogallo');
UPDATE leads SET country = 'USA' WHERE phone LIKE '+1%' AND (country IS NULL OR country != 'USA');
UPDATE leads SET country = 'Italia' WHERE phone LIKE '+39%' AND (country IS NULL OR country != 'Italia');
