-- Correggi la pipeline da VESUVIANO a Vesuviano per consistenza
UPDATE leads 
SET pipeline = 'Vesuviano' 
WHERE pipeline = 'VESUVIANO';