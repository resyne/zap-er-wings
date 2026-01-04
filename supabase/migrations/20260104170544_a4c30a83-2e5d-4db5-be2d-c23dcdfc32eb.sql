-- Aggiungi colonna is_header per distinguere i conti principali (non selezionabili)
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS is_header boolean DEFAULT false;

-- Imposta is_header = true per tutti i conti di livello 1 (conti principali)
UPDATE chart_of_accounts SET is_header = true WHERE level = 1;

-- Correggi i tipi errati
-- Il conto 02 (COGS) deve essere di tipo cogs
UPDATE chart_of_accounts SET account_type = 'cogs' WHERE code = '02';
UPDATE chart_of_accounts SET account_type = 'cogs' WHERE code LIKE '02.%';

-- Il conto 03 (Opex) deve essere di tipo opex  
UPDATE chart_of_accounts SET account_type = 'opex' WHERE code = '03';

-- Il conto 4010 (Acquisti materie prime) è un costo diretto (COGS)
UPDATE chart_of_accounts SET account_type = 'cogs' WHERE code = '4010';

-- Il conto 4000 se esiste deve essere COGS header
UPDATE chart_of_accounts SET account_type = 'cogs', is_header = true WHERE code = '4000';

-- Il conto 2000/2010 sono passività
UPDATE chart_of_accounts SET account_type = 'liability' WHERE code IN ('2000', '2010');
UPDATE chart_of_accounts SET is_header = true WHERE code = '2000';

-- Il conto 1400/1410 sono attività
UPDATE chart_of_accounts SET account_type = 'asset' WHERE code IN ('1400', '1410');
UPDATE chart_of_accounts SET is_header = true WHERE code = '1400';