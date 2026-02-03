-- Rimuove i lead_id dalle conversazioni dove c'è un mismatch tra la pipeline dell'account e la pipeline del lead
-- Questo corregge il problema delle conversazioni Zapper che mostrano contatti Vesuviano e viceversa

UPDATE whatsapp_conversations c
SET lead_id = NULL
FROM whatsapp_accounts a, leads l
WHERE c.account_id = a.id
  AND c.lead_id = l.id
  AND a.pipeline IS NOT NULL
  AND l.pipeline IS NOT NULL
  AND a.pipeline != l.pipeline;