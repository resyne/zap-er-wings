-- Backfill lead_id for existing whatsapp conversations that have matching leads by phone
WITH matches AS (
  SELECT DISTINCT ON (wc.id) wc.id as conv_id, l.id as lead_id
  FROM whatsapp_conversations wc
  JOIN whatsapp_accounts wa ON wc.account_id = wa.id
  JOIN leads l ON l.pipeline = wa.pipeline
    AND regexp_replace(l.phone, '[^0-9]', '', 'g') != ''
    AND LENGTH(regexp_replace(l.phone, '[^0-9]', '', 'g')) >= 8
    AND RIGHT(regexp_replace(l.phone, '[^0-9]', '', 'g'), 8) = RIGHT(regexp_replace(wc.customer_phone, '[^0-9]', '', 'g'), 8)
  WHERE wc.lead_id IS NULL
)
UPDATE whatsapp_conversations SET lead_id = matches.lead_id
FROM matches WHERE whatsapp_conversations.id = matches.conv_id;