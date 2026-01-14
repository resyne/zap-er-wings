-- Drop the existing check constraint
ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_vat_regime_check;

-- Add the new check constraint with forfetario included
ALTER TABLE offers ADD CONSTRAINT offers_vat_regime_check 
CHECK (vat_regime IS NULL OR vat_regime IN ('standard', 'reverse_charge', 'intra_ue', 'extra_ue', 'forfetario'));