-- Fix incorrect coordinates for KUMA FORNI in Lupatoto (should be in Italy, not Texas)
-- Lupatoto is in province of Verona, Italy
UPDATE partners 
SET latitude = 45.4042, longitude = 11.0667 
WHERE id = 'f22f5d59-6732-4402-bbf7-f7c9e97ca555' 
AND company_name = 'KUMA FORNI' 
AND address = 'Lupatoto';