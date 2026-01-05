
-- Fix stock for CM5-5 by ID (name has trailing space)
UPDATE materials 
SET current_stock = COALESCE(current_stock, 0) + 10,
    updated_at = now()
WHERE id = '84204ccf-b5c9-4df3-b84b-e7c4d18f4d6f';
