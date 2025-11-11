-- Add language field to offers table
ALTER TABLE offers ADD COLUMN IF NOT EXISTS language text DEFAULT 'it';

-- Add check constraint to ensure only valid languages are used
ALTER TABLE offers ADD CONSTRAINT offers_language_check 
  CHECK (language IN ('it', 'en', 'fr'));