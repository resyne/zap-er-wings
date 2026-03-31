-- Step 1: Map duplicates to originals by email+phone
CREATE TEMP TABLE lead_dedupe_map2 AS
WITH ranked AS (
  SELECT id, LOWER(COALESCE(email,'')) as em, LOWER(COALESCE(phone,'')) as ph,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(COALESCE(email,'')), LOWER(COALESCE(phone,''))
      ORDER BY created_at ASC
    ) as rn
  FROM leads
  WHERE pipeline = 'Vesuviano'
    AND COALESCE(email, '') != '' AND COALESCE(phone, '') != ''
)
SELECT d.id as duplicate_id, k.id as keep_id
FROM ranked d
JOIN ranked k ON d.em = k.em AND d.ph = k.ph AND k.rn = 1
WHERE d.rn > 1;

-- Step 2: Reassign all FK references
UPDATE call_records SET lead_id = m.keep_id FROM lead_dedupe_map2 m WHERE call_records.lead_id = m.duplicate_id;
UPDATE lead_activities SET lead_id = m.keep_id FROM lead_dedupe_map2 m WHERE lead_activities.lead_id = m.duplicate_id;
UPDATE lead_files SET lead_id = m.keep_id FROM lead_dedupe_map2 m WHERE lead_files.lead_id = m.duplicate_id;
UPDATE lead_comments SET lead_id = m.keep_id FROM lead_dedupe_map2 m WHERE lead_comments.lead_id = m.duplicate_id;
UPDATE lead_automation_executions SET lead_id = m.keep_id FROM lead_dedupe_map2 m WHERE lead_automation_executions.lead_id = m.duplicate_id;
UPDATE offers SET lead_id = m.keep_id FROM lead_dedupe_map2 m WHERE offers.lead_id = m.duplicate_id;
UPDATE sales_orders SET lead_id = m.keep_id FROM lead_dedupe_map2 m WHERE sales_orders.lead_id = m.duplicate_id;
UPDATE work_orders SET lead_id = m.keep_id FROM lead_dedupe_map2 m WHERE work_orders.lead_id = m.duplicate_id;
UPDATE service_work_orders SET lead_id = m.keep_id FROM lead_dedupe_map2 m WHERE service_work_orders.lead_id = m.duplicate_id;
UPDATE product_configurator_links SET lead_id = m.keep_id FROM lead_dedupe_map2 m WHERE product_configurator_links.lead_id = m.duplicate_id;
UPDATE wasender_contacts SET lead_id = m.keep_id FROM lead_dedupe_map2 m WHERE wasender_contacts.lead_id = m.duplicate_id;
UPDATE wasender_conversations SET lead_id = m.keep_id FROM lead_dedupe_map2 m WHERE wasender_conversations.lead_id = m.duplicate_id;
UPDATE whatsapp_conversations SET lead_id = m.keep_id FROM lead_dedupe_map2 m WHERE whatsapp_conversations.lead_id = m.duplicate_id;
UPDATE whatsapp_automation_executions SET lead_id = m.keep_id FROM lead_dedupe_map2 m WHERE whatsapp_automation_executions.lead_id = m.duplicate_id;
UPDATE whatsapp_opt_ins SET lead_id = m.keep_id FROM lead_dedupe_map2 m WHERE whatsapp_opt_ins.lead_id = m.duplicate_id;
UPDATE ai_cost_estimates SET lead_id = m.keep_id FROM lead_dedupe_map2 m WHERE ai_cost_estimates.lead_id = m.duplicate_id;
UPDATE commesse SET lead_id = m.keep_id FROM lead_dedupe_map2 m WHERE commesse.lead_id = m.duplicate_id;
UPDATE becca_followup_queue SET lead_id = m.keep_id FROM lead_dedupe_map2 m WHERE becca_followup_queue.lead_id = m.duplicate_id;

-- Step 3: Delete duplicates
DELETE FROM leads WHERE id IN (SELECT duplicate_id FROM lead_dedupe_map2);

-- Step 4: Create unique index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS leads_vesuviano_dedupe_idx 
ON leads (LOWER(COALESCE(email, '')), LOWER(COALESCE(phone, '')))
WHERE pipeline = 'Vesuviano' AND COALESCE(email, '') != '' AND COALESCE(phone, '') != '';

DROP TABLE IF EXISTS lead_dedupe_map2;