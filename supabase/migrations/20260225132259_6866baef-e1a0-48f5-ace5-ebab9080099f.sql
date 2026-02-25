
-- Add last_inventory_date and last_inventory_by to materials
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS last_inventory_date timestamptz;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS last_inventory_by uuid;

-- Create a trigger to update current_stock when a stock_movement is inserted with a material_id
CREATE OR REPLACE FUNCTION public.update_material_stock_on_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.material_id IS NOT NULL AND NEW.status = 'confermato' THEN
    IF NEW.movement_type = 'carico' THEN
      UPDATE materials SET current_stock = current_stock + NEW.quantity WHERE id = NEW.material_id;
    ELSIF NEW.movement_type = 'scarico' THEN
      UPDATE materials SET current_stock = GREATEST(current_stock - NEW.quantity, 0) WHERE id = NEW.material_id;
    ELSIF NEW.movement_type = 'inventario' THEN
      UPDATE materials 
      SET current_stock = NEW.quantity, 
          last_inventory_date = now(),
          last_inventory_by = NEW.created_by
      WHERE id = NEW.material_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_update_material_stock ON stock_movements;
CREATE TRIGGER trg_update_material_stock
  AFTER INSERT ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_material_stock_on_movement();

-- Also handle when movement status is updated to confermato
CREATE OR REPLACE FUNCTION public.update_material_stock_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.material_id IS NOT NULL AND NEW.status = 'confermato' AND (OLD.status IS DISTINCT FROM 'confermato') THEN
    IF NEW.movement_type = 'carico' THEN
      UPDATE materials SET current_stock = current_stock + NEW.quantity WHERE id = NEW.material_id;
    ELSIF NEW.movement_type = 'scarico' THEN
      UPDATE materials SET current_stock = GREATEST(current_stock - NEW.quantity, 0) WHERE id = NEW.material_id;
    ELSIF NEW.movement_type = 'inventario' THEN
      UPDATE materials 
      SET current_stock = NEW.quantity,
          last_inventory_date = now(),
          last_inventory_by = NEW.created_by
      WHERE id = NEW.material_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_material_stock_on_status_change ON stock_movements;
CREATE TRIGGER trg_update_material_stock_on_status_change
  AFTER UPDATE ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_material_stock_on_status_change();
