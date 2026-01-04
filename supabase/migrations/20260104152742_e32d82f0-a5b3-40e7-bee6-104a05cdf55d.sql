-- Add "escluso" status to stock_movements
-- This status means the movement is recorded but doesn't affect stock counts

COMMENT ON TABLE public.stock_movements IS 'Stock movements table with status: proposto (pending), confermato (affects stock), annullato (cancelled/deleted), escluso (excluded - recorded but no stock effect)';