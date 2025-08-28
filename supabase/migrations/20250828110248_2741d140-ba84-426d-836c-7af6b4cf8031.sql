-- Correct coordinates for Gennaro Caglione - Scafati (SA)
-- Scafati, Salerno coordinates: 40.7491, 14.5237
UPDATE partners 
SET 
  latitude = 40.7491,
  longitude = 14.5237,
  address = 'Via Galileo Ferraris 24, Scafati (SA), Italia',
  country = 'Italia'
WHERE first_name = 'Gennaro' AND last_name = 'Caglione' AND company_name = 'Zapper';