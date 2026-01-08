-- Funzione RPC per cercare lead per numero normalizzato
CREATE OR REPLACE FUNCTION find_lead_by_normalized_phone(search_pattern TEXT)
RETURNS TABLE(id UUID, phone TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT l.id, l.phone
  FROM leads l
  WHERE normalize_phone(l.phone) LIKE '%' || search_pattern || '%'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;