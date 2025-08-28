-- Update the partner_type check constraint to include 'installatore'
ALTER TABLE partners DROP CONSTRAINT partners_partner_type_check;

ALTER TABLE partners ADD CONSTRAINT partners_partner_type_check 
CHECK (partner_type = ANY (ARRAY['importatore'::text, 'rivenditore'::text, 'installatore'::text]));