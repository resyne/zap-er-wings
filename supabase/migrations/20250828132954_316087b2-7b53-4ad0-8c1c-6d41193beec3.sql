-- Add checked column to financial_movements table
ALTER TABLE financial_movements ADD COLUMN checked BOOLEAN DEFAULT false;

-- Add checked column to recurring_subscriptions table  
ALTER TABLE recurring_subscriptions ADD COLUMN checked BOOLEAN DEFAULT false;