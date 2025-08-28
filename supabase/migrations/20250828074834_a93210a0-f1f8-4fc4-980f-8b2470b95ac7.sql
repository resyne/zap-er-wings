-- Add partner type and acquisition fields to partners table
ALTER TABLE partners ADD COLUMN partner_type TEXT DEFAULT 'rivenditore' CHECK (partner_type IN ('importatore', 'rivenditore'));
ALTER TABLE partners ADD COLUMN country TEXT;
ALTER TABLE partners ADD COLUMN acquisition_status TEXT DEFAULT 'prospect' CHECK (acquisition_status IN ('prospect', 'contatto', 'negoziazione', 'contratto', 'attivo', 'inattivo'));
ALTER TABLE partners ADD COLUMN acquisition_notes TEXT;
ALTER TABLE partners ADD COLUMN priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high'));

-- Add comments for clarity
COMMENT ON COLUMN partners.partner_type IS 'Tipo di partner: importatore o rivenditore';
COMMENT ON COLUMN partners.country IS 'Paese di operazione del partner';
COMMENT ON COLUMN partners.acquisition_status IS 'Stato del processo di acquisizione';
COMMENT ON COLUMN partners.acquisition_notes IS 'Note sul processo di acquisizione';
COMMENT ON COLUMN partners.priority IS 'Priorità del partner nel processo di acquisizione';