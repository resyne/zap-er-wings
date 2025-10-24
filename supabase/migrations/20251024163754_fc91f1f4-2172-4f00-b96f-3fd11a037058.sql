-- Add payment fields to offers table
ALTER TABLE offers 
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'bonifico',
ADD COLUMN IF NOT EXISTS payment_agreement text DEFAULT '50% acconto - 50% a consegna';