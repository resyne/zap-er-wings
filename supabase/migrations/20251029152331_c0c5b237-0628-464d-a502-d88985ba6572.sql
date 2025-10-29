-- Drop existing function and trigger
DROP TRIGGER IF EXISTS set_shipping_order_number ON shipping_orders;
DROP FUNCTION IF EXISTS generate_shipping_order_number();

-- Create new function for automatic shipping order number generation
CREATE OR REPLACE FUNCTION generate_shipping_order_number()
RETURNS TRIGGER AS $$
DECLARE
  next_number INTEGER;
  year_part TEXT;
BEGIN
  -- Get the current year
  year_part := TO_CHAR(CURRENT_DATE, 'YY');
  
  -- Get the next sequential number for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM '\d+$') AS INTEGER)), 0) + 1
  INTO next_number
  FROM shipping_orders
  WHERE number LIKE 'SH' || year_part || '-%';
  
  -- Generate the new number in format: SHYY-NNNN (e.g., SH25-0001)
  NEW.number := 'SH' || year_part || '-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER set_shipping_order_number
  BEFORE INSERT ON shipping_orders
  FOR EACH ROW
  WHEN (NEW.number IS NULL OR NEW.number = '')
  EXECUTE FUNCTION generate_shipping_order_number();