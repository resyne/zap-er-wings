-- Funzione per determinare il country dal prefisso telefonico
CREATE OR REPLACE FUNCTION public.detect_country_from_phone(phone_number TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cleaned_phone TEXT;
BEGIN
  -- Rimuovi spazi e caratteri non numerici tranne il +
  cleaned_phone := regexp_replace(phone_number, '[^0-9+]', '', 'g');
  
  -- Controlla i prefissi internazionali
  IF cleaned_phone LIKE '+39%' OR cleaned_phone LIKE '0039%' THEN
    RETURN 'Italia';
  ELSIF cleaned_phone LIKE '+34%' OR cleaned_phone LIKE '0034%' THEN
    RETURN 'Spagna';
  ELSIF cleaned_phone LIKE '+44%' OR cleaned_phone LIKE '0044%' THEN
    RETURN 'UK';
  ELSIF cleaned_phone LIKE '+33%' OR cleaned_phone LIKE '0033%' THEN
    RETURN 'Francia';
  ELSIF cleaned_phone LIKE '+49%' OR cleaned_phone LIKE '0049%' THEN
    RETURN 'Germania';
  ELSIF cleaned_phone LIKE '+351%' OR cleaned_phone LIKE '00351%' THEN
    RETURN 'Portogallo';
  ELSIF cleaned_phone LIKE '+1%' OR cleaned_phone LIKE '001%' THEN
    RETURN 'USA';
  ELSE
    RETURN NULL; -- Prefisso non riconosciuto
  END IF;
END;
$$;

-- Trigger function per impostare automaticamente il country
CREATE OR REPLACE FUNCTION public.auto_set_lead_country()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  detected_country TEXT;
BEGIN
  -- Solo se il country è NULL o vuoto e c'è un numero di telefono
  IF (NEW.country IS NULL OR NEW.country = '') AND NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    detected_country := detect_country_from_phone(NEW.phone);
    IF detected_country IS NOT NULL THEN
      NEW.country := detected_country;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Crea il trigger sui leads (se non esiste già)
DROP TRIGGER IF EXISTS trigger_auto_set_lead_country ON public.leads;
CREATE TRIGGER trigger_auto_set_lead_country
  BEFORE INSERT OR UPDATE OF phone ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_lead_country();

-- Aggiorna tutti i lead esistenti che non hanno country impostato
UPDATE public.leads
SET country = detect_country_from_phone(phone)
WHERE (country IS NULL OR country = '')
  AND phone IS NOT NULL 
  AND phone != ''
  AND detect_country_from_phone(phone) IS NOT NULL;