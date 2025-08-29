-- Connect level 2 BOMs to warehouse materials
ALTER TABLE public.boms 
ADD COLUMN material_id UUID REFERENCES public.materials(id);

-- Create index for better performance
CREATE INDEX idx_boms_material_id ON public.boms(material_id);

-- Add comment for clarity
COMMENT ON COLUMN public.boms.material_id IS 'Reference to warehouse material (only for level 2 BOMs)';

-- Create a function to automatically reduce stock when creating production work orders
CREATE OR REPLACE FUNCTION public.reduce_stock_for_production_order()
RETURNS TRIGGER AS $$
DECLARE
    bom_record RECORD;
    material_record RECORD;
    inclusion_record RECORD;
    required_quantity NUMERIC;
BEGIN
    -- Only process if the work order has a BOM assigned
    IF NEW.bom_id IS NOT NULL THEN
        -- Get the main BOM
        SELECT * INTO bom_record FROM public.boms WHERE id = NEW.bom_id;
        
        IF bom_record.level = 2 AND bom_record.material_id IS NOT NULL THEN
            -- Level 2 BOM: reduce stock directly
            UPDATE public.materials 
            SET current_stock = current_stock - 1
            WHERE id = bom_record.material_id AND current_stock >= 1;
        ELSIF bom_record.level IN (0, 1) THEN
            -- Level 0 or 1 BOM: reduce stock for all included level 2 BOMs
            FOR inclusion_record IN 
                SELECT bi.*, b.material_id, b.level
                FROM public.bom_inclusions bi
                JOIN public.boms b ON bi.included_bom_id = b.id
                WHERE bi.parent_bom_id = NEW.bom_id AND b.level = 2 AND b.material_id IS NOT NULL
            LOOP
                UPDATE public.materials 
                SET current_stock = current_stock - inclusion_record.quantity
                WHERE id = inclusion_record.material_id AND current_stock >= inclusion_record.quantity;
            END LOOP;
            
            -- Also check for nested inclusions (Level 1 BOMs that include Level 2 BOMs)
            IF bom_record.level = 0 THEN
                FOR inclusion_record IN 
                    SELECT bi2.*, b2.material_id
                    FROM public.bom_inclusions bi1
                    JOIN public.bom_inclusions bi2 ON bi1.included_bom_id = bi2.parent_bom_id
                    JOIN public.boms b2 ON bi2.included_bom_id = b2.id
                    WHERE bi1.parent_bom_id = NEW.bom_id AND b2.level = 2 AND b2.material_id IS NOT NULL
                LOOP
                    UPDATE public.materials 
                    SET current_stock = current_stock - inclusion_record.quantity
                    WHERE id = inclusion_record.material_id AND current_stock >= inclusion_record.quantity;
                END LOOP;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';