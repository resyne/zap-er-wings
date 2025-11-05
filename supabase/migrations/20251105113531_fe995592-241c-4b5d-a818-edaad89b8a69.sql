-- Create call_records table
CREATE TABLE call_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_number text NOT NULL,
  called_number text NOT NULL,
  service text NOT NULL,
  call_date date NOT NULL,
  call_time time NOT NULL,
  duration_seconds numeric NOT NULL,
  unique_call_id text NOT NULL UNIQUE,
  recording_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create index on call_date for faster queries
CREATE INDEX idx_call_records_date ON call_records(call_date DESC);
CREATE INDEX idx_call_records_caller ON call_records(caller_number);
CREATE INDEX idx_call_records_called ON call_records(called_number);

-- Enable RLS
ALTER TABLE call_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view call records"
  ON call_records
  FOR SELECT
  USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Service role can manage call records"
  ON call_records
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create storage bucket for call recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('call-recordings', 'call-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for call recordings
CREATE POLICY "Users can view call recordings"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'call-recordings' AND has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Service role can upload call recordings"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'call-recordings');

CREATE POLICY "Service role can update call recordings"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'call-recordings');

-- Trigger for updated_at
CREATE TRIGGER update_call_records_updated_at
  BEFORE UPDATE ON call_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();