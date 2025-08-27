-- Crea sequenza per numeri ordine di vendita
CREATE SEQUENCE IF NOT EXISTS sales_order_sequence START 1;

-- Funzione per generare numero ordine automatico
CREATE OR REPLACE FUNCTION generate_sales_order_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'SO-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('sales_order_sequence')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger per generare automaticamente il numero ordine se non specificato
CREATE OR REPLACE FUNCTION auto_generate_sales_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.number IS NULL OR NEW.number = '' THEN
        NEW.number := generate_sales_order_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crea il trigger
DROP TRIGGER IF EXISTS auto_sales_order_number_trigger ON sales_orders;
CREATE TRIGGER auto_sales_order_number_trigger
    BEFORE INSERT ON sales_orders
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_sales_order_number();