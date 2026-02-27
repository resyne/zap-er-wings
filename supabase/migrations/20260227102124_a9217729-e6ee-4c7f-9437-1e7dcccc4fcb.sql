
-- Backfill sales_order_items for all existing sales orders that have parseable product codes
-- This extracts 33-XXXX codes from article and order_subject fields

-- Create a temporary function to parse and insert items
DO $$
DECLARE
  rec RECORD;
  code_match TEXT;
  product_rec RECORD;
  codes TEXT[];
  code TEXT;
  already_added TEXT[];
BEGIN
  -- Loop through all sales orders without items
  FOR rec IN 
    SELECT so.id, so.number, COALESCE(so.article, '') || ' ' || COALESCE(so.order_subject, '') as full_text
    FROM sales_orders so
    WHERE NOT EXISTS (SELECT 1 FROM sales_order_items soi WHERE soi.sales_order_id = so.id)
    AND (so.article IS NOT NULL OR so.order_subject IS NOT NULL)
  LOOP
    already_added := ARRAY[]::TEXT[];
    
    -- Extract all 33-XXXX codes using regexp_matches
    FOR code_match IN 
      SELECT DISTINCT m[1] 
      FROM regexp_matches(rec.full_text, '(33-\d{4}(?:-[A-Z]+)?)', 'g') as m
    LOOP
      -- Skip if already added this code for this order
      IF code_match = ANY(already_added) THEN
        CONTINUE;
      END IF;
      
      -- Find the product
      SELECT p.id, p.name INTO product_rec
      FROM products p
      WHERE p.code = code_match
      LIMIT 1;
      
      IF product_rec.id IS NOT NULL THEN
        -- Count occurrences of this code to determine quantity
        INSERT INTO sales_order_items (sales_order_id, product_id, product_name, quantity, unit_price, discount_percent, vat_rate)
        VALUES (rec.id, product_rec.id, product_rec.name, 
          (SELECT count(*) FROM regexp_matches(rec.full_text, code_match, 'g')),
          0, 0, 0);
        
        already_added := array_append(already_added, code_match);
      END IF;
    END LOOP;
    
    -- If no codes found, try to match product names from the text
    IF array_length(already_added, 1) IS NULL OR array_length(already_added, 1) = 0 THEN
      -- Try matching known product patterns
      -- ZPZ MAX
      IF rec.full_text ~* '\bZPZ\s*MAX\b' AND NOT ('ZPZ MAX' = ANY(already_added)) THEN
        SELECT p.id, p.name INTO product_rec FROM products p WHERE p.code = '33-0005' LIMIT 1;
        IF product_rec.id IS NOT NULL THEN
          INSERT INTO sales_order_items (sales_order_id, product_id, product_name, quantity, unit_price, discount_percent, vat_rate)
          VALUES (rec.id, product_rec.id, product_rec.name, 1, 0, 0, 0);
          already_added := array_append(already_added, 'ZPZ MAX');
        END IF;
      END IF;
      
      -- ZPZ NUVOLA L
      IF rec.full_text ~* '\bZPZ\s*NUVOLA\s*L\b' AND NOT ('ZPZ NUVOLA L' = ANY(already_added)) THEN
        SELECT p.id, p.name INTO product_rec FROM products p WHERE p.code = '33-0006' LIMIT 1;
        IF product_rec.id IS NOT NULL THEN
          INSERT INTO sales_order_items (sales_order_id, product_id, product_name, quantity, unit_price, discount_percent, vat_rate)
          VALUES (rec.id, product_rec.id, product_rec.name, 1, 0, 0, 0);
          already_added := array_append(already_added, 'ZPZ NUVOLA L');
        END IF;
      END IF;
      
      -- ZPZ NUVOLA (without L)
      IF rec.full_text ~* '\bZPZ\s*NUVOLA\b' AND NOT rec.full_text ~* '\bZPZ\s*NUVOLA\s*L\b' AND NOT ('ZPZ NUVOLA' = ANY(already_added)) THEN
        SELECT p.id, p.name INTO product_rec FROM products p WHERE p.code = '33-0029' LIMIT 1;
        IF product_rec.id IS NOT NULL THEN
          INSERT INTO sales_order_items (sales_order_id, product_id, product_name, quantity, unit_price, discount_percent, vat_rate)
          VALUES (rec.id, product_rec.id, product_rec.name, 1, 0, 0, 0);
          already_added := array_append(already_added, 'ZPZ NUVOLA');
        END IF;
      END IF;
      
      -- ZBR MAX
      IF rec.full_text ~* '\bZBR\s*MAX\b' AND NOT ('ZBR MAX' = ANY(already_added)) THEN
        SELECT p.id, p.name INTO product_rec FROM products p WHERE p.code = '33-0001' LIMIT 1;
        IF product_rec.id IS NOT NULL THEN
          INSERT INTO sales_order_items (sales_order_id, product_id, product_name, quantity, unit_price, discount_percent, vat_rate)
          VALUES (rec.id, product_rec.id, product_rec.name, 1, 0, 0, 0);
          already_added := array_append(already_added, 'ZBR MAX');
        END IF;
      END IF;
      
      -- ZBR S or ZBR-S
      IF rec.full_text ~* '\bZBR[\s-]*S\b' AND NOT ('ZBR S' = ANY(already_added)) THEN
        SELECT p.id, p.name INTO product_rec FROM products p WHERE p.code = '33-0010' LIMIT 1;
        IF product_rec.id IS NOT NULL THEN
          INSERT INTO sales_order_items (sales_order_id, product_id, product_name, quantity, unit_price, discount_percent, vat_rate)
          VALUES (rec.id, product_rec.id, product_rec.name, 1, 0, 0, 0);
          already_added := array_append(already_added, 'ZBR S');
        END IF;
      END IF;
      
      -- ZCL MAX
      IF rec.full_text ~* '\bZCL\s*MAX\b' AND NOT ('ZCL MAX' = ANY(already_added)) THEN
        SELECT p.id, p.name INTO product_rec FROM products p WHERE p.code = '33-0022' LIMIT 1;
        IF product_rec.id IS NOT NULL THEN
          INSERT INTO sales_order_items (sales_order_id, product_id, product_name, quantity, unit_price, discount_percent, vat_rate)
          VALUES (rec.id, product_rec.id, product_rec.name, 1, 0, 0, 0);
          already_added := array_append(already_added, 'ZCL MAX');
        END IF;
      END IF;
      
      -- ZCL (plain, not MAX or S)
      IF rec.full_text ~* '\bZCL\b' AND NOT rec.full_text ~* '\bZCL\s*(MAX|S)\b' AND NOT ('ZCL' = ANY(already_added)) THEN
        SELECT p.id, p.name INTO product_rec FROM products p WHERE p.code = '33-0004' LIMIT 1;
        IF product_rec.id IS NOT NULL THEN
          INSERT INTO sales_order_items (sales_order_id, product_id, product_name, quantity, unit_price, discount_percent, vat_rate)
          VALUES (rec.id, product_rec.id, product_rec.name, 1, 0, 0, 0);
          already_added := array_append(already_added, 'ZCL');
        END IF;
      END IF;
      
      -- ZPZ (plain, not MAX or NUVOLA)
      IF rec.full_text ~* '\bZPZ\b' AND NOT rec.full_text ~* '\bZPZ\s*(MAX|NUVOLA)\b' AND NOT ('ZPZ' = ANY(already_added)) THEN
        SELECT p.id, p.name INTO product_rec FROM products p WHERE p.code = '33-0030' LIMIT 1;
        IF product_rec.id IS NOT NULL THEN
          INSERT INTO sales_order_items (sales_order_id, product_id, product_name, quantity, unit_price, discount_percent, vat_rate)
          VALUES (rec.id, product_rec.id, product_rec.name, 1, 0, 0, 0);
          already_added := array_append(already_added, 'ZPZ');
        END IF;
      END IF;
      
      -- ZPF MAX
      IF rec.full_text ~* '\bZPF\s*MAX\b' AND NOT ('ZPF MAX' = ANY(already_added)) THEN
        SELECT p.id, p.name INTO product_rec FROM products p WHERE p.code = '33-0027' LIMIT 1;
        IF product_rec.id IS NOT NULL THEN
          INSERT INTO sales_order_items (sales_order_id, product_id, product_name, quantity, unit_price, discount_percent, vat_rate)
          VALUES (rec.id, product_rec.id, product_rec.name, 1, 0, 0, 0);
          already_added := array_append(already_added, 'ZPF MAX');
        END IF;
      END IF;
      
      -- Z MAX or Z-MAX
      IF rec.full_text ~* '\bZ[\s-]*MAX\b' AND NOT rec.full_text ~* '\b(ZPZ|ZBR|ZCL|ZPF)\s*MAX\b' AND NOT ('Z MAX' = ANY(already_added)) THEN
        SELECT p.id, p.name INTO product_rec FROM products p WHERE p.code = '33-0018' LIMIT 1;
        IF product_rec.id IS NOT NULL THEN
          INSERT INTO sales_order_items (sales_order_id, product_id, product_name, quantity, unit_price, discount_percent, vat_rate)
          VALUES (rec.id, product_rec.id, product_rec.name, 1, 0, 0, 0);
          already_added := array_append(already_added, 'Z MAX');
        END IF;
      END IF;
    END IF;
    
    -- Also add secondary products regardless of whether primary was found by code or name
    -- Elettrovalvola
    IF rec.full_text ~* 'Elettrovalvola' AND NOT ('33-0002' = ANY(already_added)) THEN
      SELECT p.id, p.name INTO product_rec FROM products p WHERE p.code = '33-0002' LIMIT 1;
      IF product_rec.id IS NOT NULL THEN
        INSERT INTO sales_order_items (sales_order_id, product_id, product_name, quantity, unit_price, discount_percent, vat_rate)
        VALUES (rec.id, product_rec.id, product_rec.name, 1, 0, 0, 0);
      END IF;
    END IF;
    
    -- Allaccio Elettrico
    IF rec.full_text ~* 'Allaccio Elettrico' AND NOT ('33-0007' = ANY(already_added)) THEN
      SELECT p.id, p.name INTO product_rec FROM products p WHERE p.code = '33-0007' LIMIT 1;
      IF product_rec.id IS NOT NULL THEN
        INSERT INTO sales_order_items (sales_order_id, product_id, product_name, quantity, unit_price, discount_percent, vat_rate)
        VALUES (rec.id, product_rec.id, product_rec.name, 1, 0, 0, 0);
      END IF;
    END IF;
    
    -- Allaccio Idrico
    IF rec.full_text ~* 'Allaccio Idrico' AND NOT ('33-0008' = ANY(already_added)) THEN
      SELECT p.id, p.name INTO product_rec FROM products p WHERE p.code = '33-0008' LIMIT 1;
      IF product_rec.id IS NOT NULL THEN
        INSERT INTO sales_order_items (sales_order_id, product_id, product_name, quantity, unit_price, discount_percent, vat_rate)
        VALUES (rec.id, product_rec.id, product_rec.name, 1, 0, 0, 0);
      END IF;
    END IF;
    
    -- Filtro Anti-Otturazione
    IF rec.full_text ~* 'Filtro Anti' AND NOT ('33-0009' = ANY(already_added)) THEN
      SELECT p.id, p.name INTO product_rec FROM products p WHERE p.code = '33-0009' LIMIT 1;
      IF product_rec.id IS NOT NULL THEN
        INSERT INTO sales_order_items (sales_order_id, product_id, product_name, quantity, unit_price, discount_percent, vat_rate)
        VALUES (rec.id, product_rec.id, product_rec.name, 1, 0, 0, 0);
      END IF;
    END IF;
    
    -- DOSATRON
    IF rec.full_text ~* '\bDOSATRON\b' AND NOT ('33-0011' = ANY(already_added)) THEN
      SELECT p.id, p.name INTO product_rec FROM products p WHERE p.code = '33-0011' LIMIT 1;
      IF product_rec.id IS NOT NULL THEN
        INSERT INTO sales_order_items (sales_order_id, product_id, product_name, quantity, unit_price, discount_percent, vat_rate)
        VALUES (rec.id, product_rec.id, product_rec.name, 1, 0, 0, 0);
      END IF;
    END IF;
    
    -- Z-KOR
    IF rec.full_text ~* '\bZ-KOR\b' AND NOT ('33-0012' = ANY(already_added)) THEN
      SELECT p.id, p.name INTO product_rec FROM products p WHERE p.code = '33-0012' LIMIT 1;
      IF product_rec.id IS NOT NULL THEN
        INSERT INTO sales_order_items (sales_order_id, product_id, product_name, quantity, unit_price, discount_percent, vat_rate)
        VALUES (rec.id, product_rec.id, product_rec.name, 1, 0, 0, 0);
      END IF;
    END IF;
    
    -- Z-CARE
    IF rec.full_text ~* '\bZ-CARE\b' AND NOT ('33-0017' = ANY(already_added)) THEN
      SELECT p.id, p.name INTO product_rec FROM products p WHERE p.code = '33-0017' LIMIT 1;
      IF product_rec.id IS NOT NULL THEN
        INSERT INTO sales_order_items (sales_order_id, product_id, product_name, quantity, unit_price, discount_percent, vat_rate)
        VALUES (rec.id, product_rec.id, product_rec.name, 1, 0, 0, 0);
      END IF;
    END IF;
    
    -- Separatore di gocce
    IF rec.full_text ~* 'Separatore di gocce' AND NOT ('33-0016' = ANY(already_added)) THEN
      SELECT p.id, p.name INTO product_rec FROM products p WHERE p.code = '33-0016' LIMIT 1;
      IF product_rec.id IS NOT NULL THEN
        INSERT INTO sales_order_items (sales_order_id, product_id, product_name, quantity, unit_price, discount_percent, vat_rate)
        VALUES (rec.id, product_rec.id, product_rec.name, 1, 0, 0, 0);
      END IF;
    END IF;
    
    -- Silenziatore
    IF rec.full_text ~* '\bSilenziatore\b' AND NOT ('33-0073' = ANY(already_added)) THEN
      SELECT p.id, p.name INTO product_rec FROM products p WHERE p.code = '33-0073' LIMIT 1;
      IF product_rec.id IS NOT NULL THEN
        INSERT INTO sales_order_items (sales_order_id, product_id, product_name, quantity, unit_price, discount_percent, vat_rate)
        VALUES (rec.id, product_rec.id, product_rec.name, 1, 0, 0, 0);
      END IF;
    END IF;
    
    -- NUVOLA PELLET
    IF rec.full_text ~* '\bNUVOLA\s*PELLET\b' AND NOT ('33-0014' = ANY(already_added)) THEN
      SELECT p.id, p.name INTO product_rec FROM products p WHERE p.code = '33-0014' LIMIT 1;
      IF product_rec.id IS NOT NULL THEN
        INSERT INTO sales_order_items (sales_order_id, product_id, product_name, quantity, unit_price, discount_percent, vat_rate)
        VALUES (rec.id, product_rec.id, product_rec.name, 1, 0, 0, 0);
      END IF;
    END IF;
    
    -- Antischiuma
    IF rec.full_text ~* '\b[Aa]ntischiuma\b' AND NOT ('33-0013' = ANY(already_added)) THEN
      SELECT p.id, p.name INTO product_rec FROM products p WHERE p.code = '33-0013' LIMIT 1;
      IF product_rec.id IS NOT NULL THEN
        INSERT INTO sales_order_items (sales_order_id, product_id, product_name, quantity, unit_price, discount_percent, vat_rate)
        VALUES (rec.id, product_rec.id, product_rec.name, 1, 0, 0, 0);
      END IF;
    END IF;
    
    -- Z-QUIET
    IF rec.full_text ~* '\bZ-QUIET\b' AND NOT ('33-0019' = ANY(already_added)) THEN
      SELECT p.id, p.name INTO product_rec FROM products p WHERE p.code = '33-0019' LIMIT 1;
      IF product_rec.id IS NOT NULL THEN
        INSERT INTO sales_order_items (sales_order_id, product_id, product_name, quantity, unit_price, discount_percent, vat_rate)
        VALUES (rec.id, product_rec.id, product_rec.name, 1, 0, 0, 0);
      END IF;
    END IF;
    
  END LOOP;
END $$;
