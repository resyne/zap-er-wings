-- Modify offers table to replace reverse_charge with vat_regime
-- First add the new column
ALTER TABLE offers ADD COLUMN IF NOT EXISTS vat_regime text DEFAULT 'standard';

-- Add check constraint for valid VAT regimes
ALTER TABLE offers ADD CONSTRAINT offers_vat_regime_check 
  CHECK (vat_regime IN ('standard', 'reverse_charge', 'intra_ue', 'extra_ue'));

-- Migrate existing data: if reverse_charge is true, set vat_regime to 'reverse_charge'
UPDATE offers SET vat_regime = 'reverse_charge' WHERE reverse_charge = true;
UPDATE offers SET vat_regime = 'standard' WHERE reverse_charge = false OR reverse_charge IS NULL;

-- Drop the old reverse_charge column
ALTER TABLE offers DROP COLUMN IF EXISTS reverse_charge;