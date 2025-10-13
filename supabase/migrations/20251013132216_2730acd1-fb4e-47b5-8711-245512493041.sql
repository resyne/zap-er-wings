-- Drop existing check constraint
ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_status_check;

-- Add new check constraint with all status values
ALTER TABLE offers ADD CONSTRAINT offers_status_check 
CHECK (status IN ('richiesta_offerta', 'offerta_pronta', 'offerta_inviata', 'negoziazione', 'accettata', 'rifiutata', 'scaduta'));