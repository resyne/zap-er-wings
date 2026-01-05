-- Svuota nell'ordine corretto rispettando le foreign keys
DELETE FROM invoice_registry;
DELETE FROM prima_nota;
DELETE FROM accounting_entries;