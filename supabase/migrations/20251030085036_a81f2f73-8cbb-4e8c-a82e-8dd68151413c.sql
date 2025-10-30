-- Add unique_code and html_content columns to ddts table
ALTER TABLE ddts
ADD COLUMN IF NOT EXISTS unique_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS html_content TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ddts_unique_code ON ddts(unique_code);

-- Create function to generate unique DDT code
CREATE OR REPLACE FUNCTION generate_ddt_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate 8-character alphanumeric code
        new_code := upper(substr(md5(random()::text), 1, 8));
        
        -- Check if code already exists
        SELECT EXISTS(SELECT 1 FROM public.ddts WHERE unique_code = new_code) INTO code_exists;
        
        -- If code doesn't exist, return it
        IF NOT code_exists THEN
            RETURN new_code;
        END IF;
    END LOOP;
END;
$$;

-- Create trigger to auto-generate unique code for new DDTs
CREATE OR REPLACE FUNCTION auto_generate_ddt_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF NEW.unique_code IS NULL THEN
        NEW.unique_code := generate_ddt_code();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_generate_ddt_code ON ddts;
CREATE TRIGGER trigger_auto_generate_ddt_code
    BEFORE INSERT ON ddts
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_ddt_code();