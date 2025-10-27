-- Rimuove gli articoli duplicati dalle commesse, mantenendo solo il primo di ogni gruppo
-- (quello con l'ID più vecchio)

WITH duplicates AS (
  SELECT 
    id,
    work_order_id,
    description,
    position,
    ROW_NUMBER() OVER (
      PARTITION BY work_order_id, description 
      ORDER BY position, created_at
    ) as rn
  FROM work_order_article_items
),
to_delete AS (
  SELECT id
  FROM duplicates
  WHERE rn > 1
)
DELETE FROM work_order_article_items
WHERE id IN (SELECT id FROM to_delete);

-- Ricalcola le posizioni per assicurarsi che siano sequenziali
WITH ranked_items AS (
  SELECT 
    id,
    work_order_id,
    ROW_NUMBER() OVER (PARTITION BY work_order_id ORDER BY position, created_at) - 1 as new_position
  FROM work_order_article_items
)
UPDATE work_order_article_items woi
SET position = ri.new_position
FROM ranked_items ri
WHERE woi.id = ri.id;