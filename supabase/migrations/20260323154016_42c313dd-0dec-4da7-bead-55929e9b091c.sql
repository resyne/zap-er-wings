-- Delete duplicate bank_movements keeping the oldest record
DELETE FROM bank_movements 
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY movement_date, amount, direction, substring(description, 1, 80)
      ORDER BY created_at ASC
    ) as rn
    FROM bank_movements
  ) sub
  WHERE rn > 1
);