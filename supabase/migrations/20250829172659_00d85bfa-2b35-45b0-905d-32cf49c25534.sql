-- Inserisce le relazioni mancanti nella tabella bom_inclusions
-- Collega il BOM ZPZ al BOM "Kit nebulizzazione"
INSERT INTO public.bom_inclusions (parent_bom_id, included_bom_id, quantity, notes)
SELECT 
    parent.id as parent_bom_id,
    child.id as included_bom_id,
    1 as quantity,
    'Auto-generated from parent_id relationship' as notes
FROM public.boms child
JOIN public.boms parent ON child.parent_id = parent.id
WHERE NOT EXISTS (
    SELECT 1 FROM public.bom_inclusions 
    WHERE parent_bom_id = parent.id AND included_bom_id = child.id
);