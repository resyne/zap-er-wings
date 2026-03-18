-- Add partial payment statuses to financial_status constraint
ALTER TABLE invoice_registry DROP CONSTRAINT IF EXISTS invoice_registry_financial_status_check;

ALTER TABLE invoice_registry ADD CONSTRAINT invoice_registry_financial_status_check
CHECK (financial_status IN (
  'da_incassare', 'da_pagare', 
  'parzialmente_incassata', 'parzialmente_pagata',
  'incassata', 'pagata'
));