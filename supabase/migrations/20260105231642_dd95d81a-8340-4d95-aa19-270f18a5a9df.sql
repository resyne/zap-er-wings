-- Aggiungi campi audit per gestione storno nel registro contabile
ALTER TABLE invoice_registry 
ADD COLUMN IF NOT EXISTS stornato boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS data_storno timestamp with time zone,
ADD COLUMN IF NOT EXISTS utente_storno uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS motivo_storno text,
ADD COLUMN IF NOT EXISTS scrittura_stornata_id uuid REFERENCES prima_nota(id),
ADD COLUMN IF NOT EXISTS scrittura_storno_id uuid REFERENCES prima_nota(id),
ADD COLUMN IF NOT EXISTS contabilizzazione_valida boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS periodo_chiuso boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS evento_lockato boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS event_type text;

-- Crea indice per filtro su eventi stornati/da riclassificare
CREATE INDEX IF NOT EXISTS idx_invoice_registry_stornato ON invoice_registry(stornato) WHERE stornato = true;
CREATE INDEX IF NOT EXISTS idx_invoice_registry_status ON invoice_registry(status);