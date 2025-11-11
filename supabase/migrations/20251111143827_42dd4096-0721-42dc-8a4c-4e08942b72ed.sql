-- Add new fields to price_lists table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'price_lists' AND column_name = 'default_multiplier') THEN
    ALTER TABLE price_lists ADD COLUMN default_multiplier numeric DEFAULT 1.5;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'price_lists' AND column_name = 'target_type') THEN
    ALTER TABLE price_lists ADD COLUMN target_type text CHECK (target_type IN ('cliente', 'partner'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'price_lists' AND column_name = 'tier') THEN
    ALTER TABLE price_lists ADD COLUMN tier text CHECK (tier IN ('T', 'M', 'L'));
  END IF;
END $$;

-- Update list_type constraint
ALTER TABLE price_lists DROP CONSTRAINT IF EXISTS price_lists_list_type_check;
ALTER TABLE price_lists
ADD CONSTRAINT price_lists_list_type_check 
CHECK (list_type IN ('country', 'generic', 'region', 'customer_category', 'reseller', 'custom'));

-- Add new fields to price_list_items table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'price_list_items' AND column_name = 'cost_price') THEN
    ALTER TABLE price_list_items ADD COLUMN cost_price numeric;
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN price_lists.default_multiplier IS 'Moltiplicatore di default da applicare ai costi per calcolare i prezzi';
COMMENT ON COLUMN price_lists.target_type IS 'Se il listino è per Cliente o Partner';
COMMENT ON COLUMN price_lists.tier IS 'Categoria: T (Top), M (Medium), L (Low)';
COMMENT ON COLUMN price_list_items.cost_price IS 'Costo del prodotto al momento della creazione del listino';