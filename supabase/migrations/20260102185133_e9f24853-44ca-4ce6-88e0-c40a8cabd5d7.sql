-- Add new columns to cost_centers for Centro di Costo/Ricavo management
ALTER TABLE cost_centers 
ADD COLUMN IF NOT EXISTS center_type text DEFAULT 'costo',
ADD COLUMN IF NOT EXISTS category text,
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES cost_centers(id),
ADD COLUMN IF NOT EXISTS responsible_id uuid;

-- Add comments for clarity
COMMENT ON COLUMN cost_centers.center_type IS 'Tipo centro: costo, ricavo, misto';
COMMENT ON COLUMN cost_centers.category IS 'Categoria: reparto, prodotto, cliente, progetto, team';
COMMENT ON COLUMN cost_centers.parent_id IS 'ID del centro padre per struttura gerarchica';
COMMENT ON COLUMN cost_centers.responsible_id IS 'ID utente responsabile del centro';