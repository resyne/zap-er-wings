-- Add new status values to the enum type
ALTER TYPE wo_status ADD VALUE IF NOT EXISTS 'da_fare';
ALTER TYPE wo_status ADD VALUE IF NOT EXISTS 'in_test';
ALTER TYPE wo_status ADD VALUE IF NOT EXISTS 'pronto';
ALTER TYPE wo_status ADD VALUE IF NOT EXISTS 'completato';
ALTER TYPE wo_status ADD VALUE IF NOT EXISTS 'standby';
ALTER TYPE wo_status ADD VALUE IF NOT EXISTS 'bloccato';