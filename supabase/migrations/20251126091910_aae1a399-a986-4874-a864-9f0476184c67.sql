-- Add company_entity field to offers table
ALTER TABLE offers 
ADD COLUMN company_entity text DEFAULT 'climatel' CHECK (company_entity IN ('climatel', 'unita1'));