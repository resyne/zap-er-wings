-- Aggiungi il valore 'test' mancante all'enum
ALTER TYPE wo_status ADD VALUE IF NOT EXISTS 'test';