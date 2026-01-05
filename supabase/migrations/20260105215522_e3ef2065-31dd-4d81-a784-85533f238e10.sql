-- Correggi lo stato finanziario della fattura a "non_pagata"
UPDATE accounting_entries 
SET financial_status = 'non_pagata'
WHERE id = '7eb53db6-d524-4c17-aac3-04eb3d94c7bf';

-- Aggiorna anche prima_nota se necessario
UPDATE prima_nota 
SET amount = -64.538
WHERE id = '6e5cb97d-518d-4dbd-9a21-1a85a8d26bcf' 
AND amount != -64.538;