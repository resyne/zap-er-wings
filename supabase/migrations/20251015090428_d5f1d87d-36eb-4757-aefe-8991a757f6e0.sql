-- Add scheduled_date to tickets table
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS scheduled_date timestamp with time zone;