ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_company_entity_check;
ALTER TABLE offers ADD CONSTRAINT offers_company_entity_check CHECK (company_entity IN ('climatel', 'unita1', 'wise'));