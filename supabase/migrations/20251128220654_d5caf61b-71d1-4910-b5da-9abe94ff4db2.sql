-- Add variant column to boms table
ALTER TABLE boms ADD COLUMN IF NOT EXISTS variant TEXT;

-- Drop existing unique constraint that blocks the restructuring
ALTER TABLE boms DROP CONSTRAINT IF EXISTS boms_name_version_key;

-- For Level 0 BOMs: move name to variant, machinery_model to name
-- But handle duplicates by appending a counter
DO $$
DECLARE
  bom_record RECORD;
  new_name TEXT;
  counter INT;
BEGIN
  FOR bom_record IN 
    SELECT id, name, machinery_model, version
    FROM boms 
    WHERE level = 0 AND machinery_model IS NOT NULL
  LOOP
    new_name := bom_record.machinery_model;
    counter := 1;
    
    -- Check if this name+version combination would create a duplicate
    WHILE EXISTS (
      SELECT 1 FROM boms 
      WHERE name = new_name 
        AND version = bom_record.version 
        AND id != bom_record.id
    ) LOOP
      new_name := bom_record.machinery_model || ' (' || counter || ')';
      counter := counter + 1;
    END LOOP;
    
    -- Update the record
    UPDATE boms 
    SET variant = name, 
        name = new_name
    WHERE id = bom_record.id;
  END LOOP;
END $$;

-- Create new unique constraint with name+variant+version for level 0, name+version for others
-- Note: We cannot have a single constraint that conditionally applies different columns
-- So we'll use a unique index with a WHERE clause instead
CREATE UNIQUE INDEX IF NOT EXISTS idx_boms_unique_level0 
ON boms(name, COALESCE(variant, ''), version) 
WHERE level = 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_boms_unique_other_levels 
ON boms(name, version) 
WHERE level > 0;

-- Create function to auto-increment BOM version
CREATE OR REPLACE FUNCTION get_next_bom_version(p_name TEXT, p_variant TEXT DEFAULT NULL, p_level INT DEFAULT 0)
RETURNS TEXT AS $$
DECLARE
  v_version_num INT;
BEGIN
  -- Get the highest version number for this name+variant combination
  IF p_level = 0 AND p_variant IS NOT NULL THEN
    -- For machinery (level 0) with variant, consider name + variant
    SELECT MAX(CAST(REPLACE(REPLACE(version, 'v.', ''), 'v', '') AS INT))
    INTO v_version_num
    FROM boms
    WHERE name = p_name 
      AND variant = p_variant
      AND level = p_level;
  ELSIF p_level = 0 THEN
    -- For machinery (level 0) without variant
    SELECT MAX(CAST(REPLACE(REPLACE(version, 'v.', ''), 'v', '') AS INT))
    INTO v_version_num
    FROM boms
    WHERE name = p_name 
      AND variant IS NULL
      AND level = p_level;
  ELSE
    -- For other levels, consider only name
    SELECT MAX(CAST(REPLACE(REPLACE(version, 'v.', ''), 'v', '') AS INT))
    INTO v_version_num
    FROM boms
    WHERE name = p_name 
      AND level = p_level;
  END IF;
  
  -- If no version exists, start with v.01, otherwise increment
  IF v_version_num IS NULL THEN
    RETURN 'v.01';
  ELSE
    RETURN 'v.' || LPAD((v_version_num + 1)::TEXT, 2, '0');
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create index for faster version lookups
CREATE INDEX IF NOT EXISTS idx_boms_name_variant_level ON boms(name, variant, level);

-- Add comments to explain the new structure
COMMENT ON COLUMN boms.name IS 'For Level 0: base model name (e.g., ZBR MAX). For other levels: primary identifier';
COMMENT ON COLUMN boms.variant IS 'For Level 0: specific configuration (e.g., 350 mm, 400 mm). Optional for other levels';
COMMENT ON COLUMN boms.version IS 'Auto-incremented version (v.01, v.02, etc.). Use get_next_bom_version() to get next version';
COMMENT ON COLUMN boms.machinery_model IS 'DEPRECATED: Use name+variant instead. Kept for backward compatibility';