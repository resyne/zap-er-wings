-- Create table for safety training records
CREATE TABLE IF NOT EXISTS safety_training_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  training_type TEXT NOT NULL CHECK (training_type IN ('generale', 'alto_rischio', 'pav_base', 'pes_esperto', 'rspp')),
  training_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  certificate_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create table for safety documents (DUVRI, etc.)
CREATE TABLE IF NOT EXISTS safety_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  document_url TEXT NOT NULL,
  upload_date DATE NOT NULL,
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create table for safety appointments (RSPP, Antincendio, Primo Soccorso)
CREATE TABLE IF NOT EXISTS safety_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_type TEXT NOT NULL CHECK (appointment_type IN ('rspp', 'antincendio', 'primo_soccorso')),
  employee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  employee_name TEXT NOT NULL,
  appointment_date DATE NOT NULL,
  expiry_date DATE,
  certificate_url TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create table for medical checkups
CREATE TABLE IF NOT EXISTS medical_checkups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  checkup_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  doctor_name TEXT,
  result TEXT,
  certificate_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE safety_training_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_checkups ENABLE ROW LEVEL SECURITY;

-- Create policies (allow authenticated users to view and manage)
CREATE POLICY "Allow authenticated users to view safety_training_records"
  ON safety_training_records FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert safety_training_records"
  ON safety_training_records FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update safety_training_records"
  ON safety_training_records FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete safety_training_records"
  ON safety_training_records FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to view safety_documents"
  ON safety_documents FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert safety_documents"
  ON safety_documents FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update safety_documents"
  ON safety_documents FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete safety_documents"
  ON safety_documents FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to view safety_appointments"
  ON safety_appointments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert safety_appointments"
  ON safety_appointments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update safety_appointments"
  ON safety_appointments FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete safety_appointments"
  ON safety_appointments FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to view medical_checkups"
  ON medical_checkups FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert medical_checkups"
  ON medical_checkups FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update medical_checkups"
  ON medical_checkups FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete medical_checkups"
  ON medical_checkups FOR DELETE
  USING (auth.role() = 'authenticated');

-- Create indexes
CREATE INDEX idx_safety_training_employee ON safety_training_records(employee_id);
CREATE INDEX idx_safety_training_expiry ON safety_training_records(expiry_date);
CREATE INDEX idx_safety_appointments_employee ON safety_appointments(employee_id);
CREATE INDEX idx_medical_checkups_employee ON medical_checkups(employee_id);
CREATE INDEX idx_medical_checkups_expiry ON medical_checkups(expiry_date);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_safety_training_records_updated_at
  BEFORE UPDATE ON safety_training_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_safety_documents_updated_at
  BEFORE UPDATE ON safety_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_safety_appointments_updated_at
  BEFORE UPDATE ON safety_appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medical_checkups_updated_at
  BEFORE UPDATE ON medical_checkups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();