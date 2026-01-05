
-- Fix stock for CM5-5: add +10 from confirmed movement
UPDATE materials 
SET current_stock = COALESCE(current_stock, 0) + 10,
    updated_at = now()
WHERE LOWER(name) = LOWER('CM5-5 A-R-A-E-AVBE C1-A-A-N');
