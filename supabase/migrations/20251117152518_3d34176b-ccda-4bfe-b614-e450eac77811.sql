-- Make product_id nullable in product_configurations
ALTER TABLE product_configurations 
ALTER COLUMN product_id DROP NOT NULL;