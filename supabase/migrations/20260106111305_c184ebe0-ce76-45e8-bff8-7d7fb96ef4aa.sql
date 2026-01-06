-- Aggiorna il check constraint di scadenze per includere 'stornata' e 'saldata'
ALTER TABLE scadenze DROP CONSTRAINT IF EXISTS scadenze_stato_check;

ALTER TABLE scadenze ADD CONSTRAINT scadenze_stato_check 
CHECK (stato = ANY (ARRAY[
  'aperta'::text, 
  'parziale'::text, 
  'chiusa'::text,
  'saldata'::text,
  'stornata'::text
]));

-- Ora corregge i dati esistenti per storni già eseguiti
-- Aggiorna le scadenze collegate a invoice_registry con prima_nota rettificata
UPDATE scadenze s
SET 
    stato = 'stornata',
    importo_residuo = 0,
    note = COALESCE(note, '') || ' [STORNATA - Correzione retroattiva]'
FROM invoice_registry ir
JOIN prima_nota pn ON ir.prima_nota_id = pn.id
WHERE s.id = ir.scadenza_id
  AND pn.status = 'rettificato'
  AND s.stato NOT IN ('stornata', 'chiusa', 'saldata');