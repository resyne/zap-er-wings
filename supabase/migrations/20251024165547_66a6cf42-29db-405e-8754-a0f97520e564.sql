-- Add template column to offers table
ALTER TABLE offers 
ADD COLUMN IF NOT EXISTS template text DEFAULT 'zapper';