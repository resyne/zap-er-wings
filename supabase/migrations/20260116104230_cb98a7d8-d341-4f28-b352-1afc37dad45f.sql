-- Add barrel_diameter column to conformity_declarations
ALTER TABLE public.conformity_declarations
ADD COLUMN barrel_diameter TEXT;

-- Create a sequence for serial numbers
CREATE SEQUENCE IF NOT EXISTS conformity_serial_seq START WITH 1;

-- Create a function to generate serial numbers
CREATE OR REPLACE FUNCTION generate_conformity_serial()
RETURNS TEXT AS $$
DECLARE
    year_part TEXT;
    seq_num INTEGER;
BEGIN
    year_part := to_char(NOW(), 'YYYY');
    seq_num := nextval('conformity_serial_seq');
    RETURN 'ZPZ-' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;