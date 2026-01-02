-- Add new columns to chart_of_accounts for Piano dei Conti
ALTER TABLE chart_of_accounts 
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS default_competence text DEFAULT 'immediata',
ADD COLUMN IF NOT EXISTS requires_cost_center boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'classificazione';

-- Add comment for clarity
COMMENT ON COLUMN chart_of_accounts.description IS 'Regole d''uso e note per il conto';
COMMENT ON COLUMN chart_of_accounts.default_competence IS 'Gestione competenza predefinita: immediata, differita, rateizzata';
COMMENT ON COLUMN chart_of_accounts.requires_cost_center IS 'Se il conto richiede associazione a centro di costo';
COMMENT ON COLUMN chart_of_accounts.visibility IS 'Visibilità: classificazione, reporting, assestamenti';