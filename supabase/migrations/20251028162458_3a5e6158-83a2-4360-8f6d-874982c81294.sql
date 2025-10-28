-- Add unique_code column to offers table for public links
ALTER TABLE offers ADD COLUMN IF NOT EXISTS unique_code TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_offers_unique_code ON offers(unique_code);

-- Function to generate unique offer code
CREATE OR REPLACE FUNCTION generate_offer_code()
RETURNS TEXT
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
        SELECT EXISTS(SELECT 1 FROM public.offers WHERE unique_code = new_code) INTO code_exists;
        
        -- If code doesn't exist, return it
        IF NOT code_exists THEN
            RETURN new_code;
        END IF;
    END LOOP;
END;
$$;

-- Trigger to auto-generate unique code for new offers
CREATE OR REPLACE FUNCTION auto_generate_offer_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF NEW.unique_code IS NULL THEN
        NEW.unique_code := generate_offer_code();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_generate_offer_code ON offers;
CREATE TRIGGER trigger_auto_generate_offer_code
    BEFORE INSERT ON offers
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_offer_code();