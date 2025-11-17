-- Add shipping and installation price fields to product_configurations
ALTER TABLE product_configurations 
ADD COLUMN IF NOT EXISTS base_price_wood numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_gas numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_electric numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS price_onsite_installation numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS pizza_count_wood text,
ADD COLUMN IF NOT EXISTS pizza_count_gas_electric text;

-- Add shipping prices table
CREATE TABLE IF NOT EXISTS shipping_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  size_cm integer NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(size_cm)
);

-- Insert default shipping prices
INSERT INTO shipping_prices (size_cm, price, description) VALUES
(80, 1000, 'Spedizione in Europa con imballaggio cassonato in legno'),
(100, 1300, 'Spedizione in Europa con imballaggio cassonato in legno'),
(120, 1400, 'Spedizione in Europa con imballaggio cassonato in legno'),
(130, 1500, 'Spedizione in Europa con imballaggio cassonato in legno')
ON CONFLICT (size_cm) DO NOTHING;

-- Enable RLS on shipping_prices
ALTER TABLE shipping_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shipping prices"
  ON shipping_prices FOR SELECT
  USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Service role full access shipping prices"
  ON shipping_prices FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can view shipping prices"
  ON shipping_prices FOR SELECT
  USING (true);