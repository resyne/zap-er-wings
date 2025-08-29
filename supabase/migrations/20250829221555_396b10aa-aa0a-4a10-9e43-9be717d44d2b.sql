-- Remove all test data added in previous migrations
DELETE FROM production_work_orders WHERE description LIKE '%Test%' OR description LIKE '%Produzione%' OR description LIKE '%Assemblaggio%' OR description LIKE '%Controllo%' OR description LIKE '%Blast Chiller%';

DELETE FROM service_work_orders WHERE description LIKE '%Test%' OR description LIKE '%Manutenzione%' OR description LIKE '%Riparazione%' OR description LIKE '%Controllo%' OR description LIKE '%Installazione%';