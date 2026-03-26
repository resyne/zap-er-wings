
-- Solleciti (payment reminders) tracking table
CREATE TABLE IF NOT EXISTS solleciti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scadenza_id UUID NOT NULL REFERENCES scadenze(id) ON DELETE CASCADE,
  fattura_id UUID REFERENCES invoice_registry(id) ON DELETE SET NULL,
  livello INTEGER NOT NULL DEFAULT 1 CHECK (livello BETWEEN 1 AND 3),
  canale TEXT NOT NULL DEFAULT 'email' CHECK (canale IN ('email', 'whatsapp', 'entrambi')),
  soggetto_nome TEXT,
  soggetto_email TEXT,
  soggetto_telefono TEXT,
  importo_residuo NUMERIC NOT NULL DEFAULT 0,
  invoice_number TEXT,
  messaggio TEXT,
  stato TEXT NOT NULL DEFAULT 'inviato' CHECK (stato IN ('bozza', 'inviato', 'errore')),
  inviato_da UUID REFERENCES auth.users(id),
  inviato_at TIMESTAMPTZ DEFAULT now(),
  email_sent BOOLEAN DEFAULT false,
  whatsapp_sent BOOLEAN DEFAULT false,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add reminder_count to scadenze for quick access
ALTER TABLE scadenze ADD COLUMN IF NOT EXISTS solleciti_count INTEGER DEFAULT 0;
ALTER TABLE scadenze ADD COLUMN IF NOT EXISTS ultimo_sollecito_at TIMESTAMPTZ;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_solleciti_scadenza ON solleciti(scadenza_id);

-- RLS
ALTER TABLE solleciti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage solleciti"
  ON solleciti FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
