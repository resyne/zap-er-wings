-- Aggiungi campo back_office_manager agli ordini di produzione
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS back_office_manager uuid REFERENCES auth.users(id);

-- Aggiungi campo back_office_manager agli ordini di lavoro/servizio
ALTER TABLE service_work_orders 
ADD COLUMN IF NOT EXISTS back_office_manager uuid REFERENCES auth.users(id);

-- Aggiungi campo back_office_manager agli ordini di spedizione
ALTER TABLE shipping_orders 
ADD COLUMN IF NOT EXISTS back_office_manager uuid REFERENCES auth.users(id);

-- Crea tabella per i commenti degli ordini con supporto per tagging
CREATE TABLE IF NOT EXISTS order_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment text NOT NULL,
  mentions uuid[] DEFAULT '{}', -- Array di user IDs menzionati nel commento
  
  -- Riferimenti agli ordini (solo uno sarà popolato)
  work_order_id uuid REFERENCES work_orders(id) ON DELETE CASCADE,
  service_work_order_id uuid REFERENCES service_work_orders(id) ON DELETE CASCADE,
  shipping_order_id uuid REFERENCES shipping_orders(id) ON DELETE CASCADE,
  
  -- Constraint per assicurare che solo un tipo di ordine sia referenziato
  CONSTRAINT single_order_reference CHECK (
    (work_order_id IS NOT NULL)::integer + 
    (service_work_order_id IS NOT NULL)::integer + 
    (shipping_order_id IS NOT NULL)::integer = 1
  )
);

-- Abilita RLS per order_comments
ALTER TABLE order_comments ENABLE ROW LEVEL SECURITY;

-- Policy: gli utenti possono vedere i commenti
CREATE POLICY "Users can view order comments"
ON order_comments FOR SELECT
TO authenticated
USING (has_minimum_role(auth.uid(), 'user'::app_role));

-- Policy: gli utenti possono creare commenti
CREATE POLICY "Users can create order comments"
ON order_comments FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND
  has_minimum_role(auth.uid(), 'user'::app_role)
);

-- Policy: gli utenti possono modificare i propri commenti
CREATE POLICY "Users can update their own comments"
ON order_comments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: gli utenti possono eliminare i propri commenti
CREATE POLICY "Users can delete their own comments"
ON order_comments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Policy: service role ha accesso completo
CREATE POLICY "Service role full access order comments"
ON order_comments FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_order_comments_work_order ON order_comments(work_order_id);
CREATE INDEX IF NOT EXISTS idx_order_comments_service_work_order ON order_comments(service_work_order_id);
CREATE INDEX IF NOT EXISTS idx_order_comments_shipping_order ON order_comments(shipping_order_id);
CREATE INDEX IF NOT EXISTS idx_order_comments_user ON order_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_order_comments_created_at ON order_comments(created_at DESC);

-- Trigger per aggiornare updated_at
CREATE TRIGGER update_order_comments_updated_at
  BEFORE UPDATE ON order_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Commento sulla tabella
COMMENT ON TABLE order_comments IS 'Tabella per i commenti su ordini di produzione, lavoro e spedizione con supporto per tagging utenti';