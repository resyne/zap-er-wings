-- Disabilita tutte le automazioni email attive
UPDATE email_automations
SET is_active = false,
    updated_at = now()
WHERE is_active = true;

-- Aggiungi commento per documentare la sospensione
COMMENT ON TABLE email_automations IS 'Email automations - Currently suspended. Only manual sending is enabled.';

-- Cancella eventuali email in coda programmate da automazioni
UPDATE email_queue
SET status = 'cancelled'
WHERE status = 'pending' 
AND campaign_id IN (
  SELECT id FROM email_campaigns 
  WHERE campaign_type = 'automation'
);