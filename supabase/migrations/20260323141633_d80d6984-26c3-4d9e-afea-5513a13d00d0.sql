
-- Fix reconciliation for bank movement "Acconto Fattura 45" - link to correct invoice and scadenza
UPDATE bank_reconciliations 
SET invoice_id = '662a56b8-f923-4479-951a-aa89b0dbd14f',
    scadenza_id = '4558e035-d2be-4bfe-97ff-b8f0ffc7b864'
WHERE id = '8f8abcc3-e6a6-4ac0-920b-9a0974685d76';

-- Update scadenza residuo (7320 - 3660 = 3660) and stato to parziale
UPDATE scadenze 
SET importo_residuo = 3660.00, 
    stato = 'parziale'
WHERE id = '4558e035-d2be-4bfe-97ff-b8f0ffc7b864';

-- Update invoice 45 financial_status to parzialmente_pagata
UPDATE invoice_registry 
SET financial_status = 'parzialmente_pagata'
WHERE id = '662a56b8-f923-4479-951a-aa89b0dbd14f';
