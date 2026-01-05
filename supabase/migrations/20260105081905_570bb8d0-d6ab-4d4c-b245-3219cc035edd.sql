-- Aggiorna la P.IVA sul nuovo fornitore GRUNDFOS Pompe Italia S.r.l.
UPDATE suppliers 
SET tax_id = '09062370151'
WHERE id = '0a348318-6673-4122-a8e1-b2d7477af721' AND tax_id IS NULL;

-- Sposta tutti i materiali dal vecchio al nuovo fornitore
UPDATE materials 
SET supplier_id = '0a348318-6673-4122-a8e1-b2d7477af721'
WHERE supplier_id = '20ce1af7-f73f-4e91-acc6-0818810d2a51';

-- Elimina il vecchio fornitore Grundfos SRL
DELETE FROM suppliers 
WHERE id = '20ce1af7-f73f-4e91-acc6-0818810d2a51';