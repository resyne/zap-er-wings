-- Create table for purchase order confirmations
CREATE TABLE purchase_order_confirmations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    supplier_email TEXT NOT NULL,
    confirmation_token TEXT NOT NULL UNIQUE,
    confirmed BOOLEAN DEFAULT FALSE,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    supplier_notes TEXT,
    supplier_delivery_date DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '30 days')
);

-- Enable RLS
ALTER TABLE purchase_order_confirmations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Service role full access confirmations" 
ON purchase_order_confirmations 
FOR ALL 
USING (true)
WITH CHECK (true);

CREATE POLICY "Public can view by token" 
ON purchase_order_confirmations 
FOR SELECT 
USING (confirmation_token IS NOT NULL AND expires_at > now());

CREATE POLICY "Public can update by token" 
ON purchase_order_confirmations 
FOR UPDATE 
USING (confirmation_token IS NOT NULL AND expires_at > now() AND NOT confirmed);

-- Add trigger for updated_at
CREATE TRIGGER update_purchase_order_confirmations_updated_at
BEFORE UPDATE ON purchase_order_confirmations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add priority column to purchase_orders table
ALTER TABLE purchase_orders ADD COLUMN priority TEXT DEFAULT 'medium';

-- Add delivery_timeframe_days column to purchase_orders table
ALTER TABLE purchase_orders ADD COLUMN delivery_timeframe_days INTEGER;