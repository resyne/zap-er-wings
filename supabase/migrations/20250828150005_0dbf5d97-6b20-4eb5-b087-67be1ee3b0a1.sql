-- Add payment timing and payment date fields to financial_movements table
ALTER TABLE financial_movements 
ADD COLUMN payment_timing text CHECK (payment_timing IN ('immediato', 'differito')) DEFAULT 'immediato',
ADD COLUMN payment_date date;