-- Aggiungi campo per accessori multipli alla tabella production_work_orders
ALTER TABLE public.production_work_orders 
ADD COLUMN accessori_ids TEXT[] DEFAULT '{}';

-- Aggiungi commento alla colonna
COMMENT ON COLUMN public.production_work_orders.accessori_ids IS 'Array di IDs degli accessori (BOMs livello 3) associati all''ordine di produzione';