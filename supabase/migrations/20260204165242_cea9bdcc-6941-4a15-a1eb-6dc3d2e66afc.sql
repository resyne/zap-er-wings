-- Step 1: Delete duplicate mismatch conversations that already have a correct counterpart
-- Step 2: Move remaining mismatch conversations to the correct account
-- This is a data cleanup migration (idempotent) to fix incorrect account assignments.

-- First, delete mismatch rows that have a correct duplicate on the right account
DELETE FROM public.whatsapp_conversations
WHERE id IN (
  WITH target_accounts AS (
    SELECT id, lower(pipeline) AS pipeline_key
    FROM public.whatsapp_accounts WHERE is_active AND pipeline IS NOT NULL
  ),
  mismatches AS (
    SELECT
      c.id AS bad_conv_id,
      ta.id AS correct_account_id,
      c.customer_phone
    FROM public.whatsapp_conversations c
    JOIN public.leads l ON l.id = c.lead_id
    JOIN public.whatsapp_accounts ca ON ca.id = c.account_id
    JOIN target_accounts ta ON ta.pipeline_key = lower(l.pipeline)
    WHERE l.pipeline IS NOT NULL
      AND ca.pipeline IS NOT NULL
      AND lower(ca.pipeline) <> lower(l.pipeline)
  ),
  to_delete AS (
    SELECT m.bad_conv_id
    FROM mismatches m
    JOIN public.whatsapp_conversations existing
      ON existing.account_id = m.correct_account_id
     AND existing.customer_phone = m.customer_phone
     AND existing.id <> m.bad_conv_id
  )
  SELECT bad_conv_id FROM to_delete
);
