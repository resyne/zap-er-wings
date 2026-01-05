
-- Create CM5-6 material if it doesn't exist and set stock to 1
INSERT INTO materials (code, name, material_type, unit, current_stock, active)
SELECT 
  'CM5-6-' || substr(md5(random()::text), 1, 6),
  'CM5-6 A-R-A-E-AVBE C1-A-A-N Origin: HU',
  'materiale',
  'pcs',
  1,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM materials WHERE LOWER(name) = LOWER('CM5-6 A-R-A-E-AVBE C1-A-A-N Origin: HU')
);

-- Update material_id on stock_movements for the confirmed movements
UPDATE stock_movements sm
SET material_id = m.id
FROM materials m
WHERE sm.status = 'confermato'
AND sm.material_id IS NULL
AND LOWER(sm.item_description) = LOWER(m.name);
