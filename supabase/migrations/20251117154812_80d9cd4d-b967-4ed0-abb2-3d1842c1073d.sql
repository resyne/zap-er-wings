-- Aggiungi campi per tracciare le configurazioni completate dai clienti
ALTER TABLE configurator_links
ADD COLUMN IF NOT EXISTS customer_name TEXT,
ADD COLUMN IF NOT EXISTS customer_email TEXT,
ADD COLUMN IF NOT EXISTS customer_phone TEXT,
ADD COLUMN IF NOT EXISTS customer_company TEXT,
ADD COLUMN IF NOT EXISTS selected_model TEXT,
ADD COLUMN IF NOT EXISTS selected_power TEXT,
ADD COLUMN IF NOT EXISTS selected_size INTEGER,
ADD COLUMN IF NOT EXISTS selected_installation TEXT,
ADD COLUMN IF NOT EXISTS total_price NUMERIC,
ADD COLUMN IF NOT EXISTS configuration_data JSONB,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Indice per cercare link completati
CREATE INDEX IF NOT EXISTS idx_configurator_links_status ON configurator_links(status, submitted_at);

-- Aggiungi campo immagine alle configurazioni prodotto
ALTER TABLE product_configurations
ADD COLUMN IF NOT EXISTS image_url TEXT;