-- Step 1: Update cost centers names (without changing codes to avoid conflicts)
UPDATE cost_centers SET name = 'Produzione', description = 'Centro di costo per attività produttive' WHERE code = 'CC001';
UPDATE cost_centers SET name = 'Installazioni', description = 'Centro di costo per installazioni' WHERE code = 'CC002';
UPDATE cost_centers SET name = 'Commerciale', description = 'Centro di costo per attività commerciali' WHERE code = 'CC003';
UPDATE cost_centers SET name = 'Amministrazione', description = 'Centro di costo per attività amministrative' WHERE code = 'CC004';
UPDATE cost_centers SET name = 'Generale', description = 'Centro di costo generale' WHERE code = 'CC005';

-- Step 2: Update profit centers names
UPDATE profit_centers SET name = 'Vendita Macchinari', description = 'Ricavi dalla vendita di macchinari' WHERE code = 'PC001';
UPDATE profit_centers SET name = 'Installazioni', description = 'Ricavi da servizi di installazione' WHERE code = 'PC002';
UPDATE profit_centers SET name = 'Manutenzioni', description = 'Ricavi da servizi di manutenzione' WHERE code = 'PC003';