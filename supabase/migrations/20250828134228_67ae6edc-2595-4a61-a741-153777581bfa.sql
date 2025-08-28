-- Rename checked to monitor for financial_movements
ALTER TABLE financial_movements RENAME COLUMN checked TO monitor;

-- Rename checked to monitor for recurring_subscriptions  
ALTER TABLE recurring_subscriptions RENAME COLUMN checked TO monitor;

-- Set default value to true for monitor (items need monitoring by default)
ALTER TABLE financial_movements ALTER COLUMN monitor SET DEFAULT true;
ALTER TABLE recurring_subscriptions ALTER COLUMN monitor SET DEFAULT true;