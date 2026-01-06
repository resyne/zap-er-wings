-- Prima aggiorna il check constraint per includere tutti gli stati
ALTER TABLE invoice_registry DROP CONSTRAINT IF EXISTS invoice_registry_status_check;

ALTER TABLE invoice_registry ADD CONSTRAINT invoice_registry_status_check 
CHECK (status = ANY (ARRAY[
  'bozza'::text, 
  'registrata'::text, 
  'da_classificare'::text,
  'da_riclassificare'::text, 
  'non_rilevante'::text,
  'contabilizzato'::text,
  'rettificato'::text,
  'archiviato'::text
]));

-- Ora aggiorna invoice_registry per storni già eseguiti
UPDATE invoice_registry ir
SET 
    stornato = true,
    status = 'da_riclassificare',
    contabilizzazione_valida = false,
    data_storno = NOW()
FROM prima_nota pn
WHERE ir.prima_nota_id = pn.id
  AND pn.status = 'rettificato'
  AND (ir.stornato IS NOT TRUE OR ir.status NOT IN ('da_riclassificare', 'rettificato'));