-- Remove duplicate phone extension record for 204
DELETE FROM phone_extensions 
WHERE extension_number = '204' 
AND id = '1bdb129a-67bf-47b7-9c4a-b83c85f4662e';

-- Now fix existing call records with extension 204 that have no operator mapped
UPDATE call_records 
SET 
  operator_id = 'f69a7d31-8606-4d20-9e4c-2613c833867e',
  operator_name = 'Bruno Nardello'
WHERE extension_number = '204' 
AND (operator_id IS NULL OR operator_name IS NULL);