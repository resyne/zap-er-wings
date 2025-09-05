-- Drop the incorrect foreign key constraint pointing to companies table
ALTER TABLE customer_cost_drafts 
DROP CONSTRAINT IF EXISTS customer_cost_drafts_customer_id_fkey;

-- Add the correct foreign key constraint pointing to customers table
ALTER TABLE customer_cost_drafts 
ADD CONSTRAINT customer_cost_drafts_customer_id_fkey 
FOREIGN KEY (customer_id) REFERENCES customers(id);