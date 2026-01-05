-- Aggiungi campo per persistere lo split dei conti economici
ALTER TABLE invoice_registry 
ADD COLUMN IF NOT EXISTS account_splits jsonb DEFAULT NULL;

-- Commento esplicativo
COMMENT ON COLUMN invoice_registry.account_splits IS 'Array JSON delle righe split: [{account_id, amount, percentage, cost_center_id, profit_center_id}]';