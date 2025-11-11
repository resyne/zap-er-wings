-- Correggi tutti i lead con pipeline in maiuscolo
UPDATE leads 
SET pipeline = CASE
  WHEN pipeline = 'VESUVIANO' THEN 'Vesuviano'
  WHEN pipeline = 'ZAPPER' THEN 'Zapper'
  ELSE INITCAP(pipeline)
END
WHERE pipeline != INITCAP(pipeline);