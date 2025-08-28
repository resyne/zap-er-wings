-- Create table for materials associated with partners
CREATE TABLE partner_materials (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    material_name TEXT NOT NULL,
    material_type TEXT,
    quantity INTEGER DEFAULT 1,
    notes TEXT,
    uploaded_file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE partner_materials ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users to view partner materials" 
ON partner_materials 
FOR SELECT 
USING (true);

CREATE POLICY "Allow authenticated users to insert partner materials" 
ON partner_materials 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update partner materials" 
ON partner_materials 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow authenticated users to delete partner materials" 
ON partner_materials 
FOR DELETE 
USING (true);

-- Create index for performance
CREATE INDEX idx_partner_materials_partner_id ON partner_materials(partner_id);

-- Add trigger for updated_at
CREATE TRIGGER update_partner_materials_updated_at
BEFORE UPDATE ON partner_materials
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();