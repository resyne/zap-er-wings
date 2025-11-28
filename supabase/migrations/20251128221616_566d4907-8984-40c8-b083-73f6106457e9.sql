
-- Drop variant column and restructure for model families with variant children
ALTER TABLE boms DROP COLUMN IF EXISTS variant;

-- Update versioning function for parent-child hierarchy
CREATE OR REPLACE FUNCTION get_next_bom_version(
  p_name TEXT, 
  p_variant TEXT DEFAULT NULL, 
  p_level INT DEFAULT 0,
  p_parent_id UUID DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  v_version_num INT;
BEGIN
  IF p_parent_id IS NOT NULL THEN
    SELECT MAX(CAST(REPLACE(version, 'v.', '') AS INT))
    INTO v_version_num
    FROM boms
    WHERE name = p_name AND parent_id = p_parent_id AND level = p_level;
  ELSE
    SELECT MAX(CAST(REPLACE(version, 'v.', '') AS INT))
    INTO v_version_num
    FROM boms
    WHERE name = p_name AND parent_id IS NULL AND level = p_level;
  END IF;
  
  RETURN COALESCE('v.' || LPAD((COALESCE(v_version_num, 0) + 1)::TEXT, 2, '0'), 'v.01');
END;
$$ LANGUAGE plpgsql;

-- Fix duplicates: Increment versions for duplicate name+version+level+parent combinations
DO $$
DECLARE
  dup_row RECORD;
  bom_id UUID;
  counter INT;
BEGIN
  -- Find and fix duplicates
  FOR dup_row IN 
    WITH duplicates AS (
      SELECT 
        name, 
        version, 
        level, 
        COALESCE(parent_id::text, 'NULL') as parent_key,
        COUNT(*) as dup_count
      FROM boms
      WHERE level = 0
      GROUP BY name, version, level, COALESCE(parent_id::text, 'NULL')
      HAVING COUNT(*) > 1
    )
    SELECT 
      b.id,
      b.name,
      b.version,
      b.level,
      b.parent_id,
      b.created_at,
      ROW_NUMBER() OVER (
        PARTITION BY b.name, b.version, b.level, COALESCE(b.parent_id::text, 'NULL') 
        ORDER BY b.created_at
      ) as rn
    FROM boms b
    INNER JOIN duplicates d ON 
      b.name = d.name AND 
      b.version = d.version AND 
      b.level = d.level AND
      COALESCE(b.parent_id::text, 'NULL') = d.parent_key
    WHERE b.level = 0
  LOOP
    -- Keep first occurrence, update others
    IF dup_row.rn > 1 THEN
      UPDATE boms 
      SET version = 'v.' || LPAD(dup_row.rn::TEXT, 2, '0')
      WHERE id = dup_row.id;
    END IF;
  END LOOP;
END $$;

-- Drop old indexes
DROP INDEX IF EXISTS idx_boms_unique_level0;
DROP INDEX IF EXISTS idx_boms_unique_other_levels;
DROP INDEX IF EXISTS idx_boms_unique_level0_with_parent;
DROP INDEX IF EXISTS idx_boms_unique_level0_hierarchy;

-- Create new unique constraints
CREATE UNIQUE INDEX idx_boms_unique_level0_hierarchy 
ON boms(name, version, level, COALESCE(parent_id::text, 'NO_PARENT'))
WHERE level = 0;

CREATE UNIQUE INDEX idx_boms_unique_other_levels 
ON boms(name, version, level)
WHERE level > 0;

-- Add documentation
COMMENT ON COLUMN boms.name IS 'Model family name (Level 0, no parent) or variant description (Level 0, with parent) or component name (other levels)';
COMMENT ON COLUMN boms.parent_id IS 'NULL = model family, Set = variant under that family (Level 0), or hierarchical parent (other levels)';
COMMENT ON COLUMN boms.version IS 'Auto-incremented (v.01, v.02...). For variants, scoped within parent model';
COMMENT ON COLUMN boms.machinery_model IS 'DEPRECATED';
