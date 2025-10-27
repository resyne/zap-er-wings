-- Aggiungi la colonna escluso_fornitura alla tabella offers
ALTER TABLE offers ADD COLUMN IF NOT EXISTS escluso_fornitura TEXT;