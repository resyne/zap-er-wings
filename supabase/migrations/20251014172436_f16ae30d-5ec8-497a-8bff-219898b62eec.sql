-- Step 1: Aggiungi i nuovi valori all'enum (questa sarà committata automaticamente)
ALTER TYPE wo_status ADD VALUE IF NOT EXISTS 'in_lavorazione';
ALTER TYPE wo_status ADD VALUE IF NOT EXISTS 'pronti';
ALTER TYPE wo_status ADD VALUE IF NOT EXISTS 'spediti_consegnati';