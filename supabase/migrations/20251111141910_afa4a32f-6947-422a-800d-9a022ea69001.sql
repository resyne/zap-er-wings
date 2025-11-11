-- Add 'oven' to products product_type constraint

-- Drop existing constraint
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_product_type_check;

-- Add new constraint with 'oven' included
ALTER TABLE public.products ADD CONSTRAINT products_product_type_check 
CHECK (product_type = ANY (ARRAY['machinery'::text, 'oven'::text, 'component'::text, 'spare_part'::text, 'service'::text]));