-- Create price list audit logs table
CREATE TABLE IF NOT EXISTS price_list_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id UUID NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE price_list_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Service role full access price list audit logs"
  ON price_list_audit_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view price list audit logs"
  ON price_list_audit_logs
  FOR SELECT
  USING (has_minimum_role(auth.uid(), 'user'::app_role));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_price_list_audit_logs_price_list_id 
  ON price_list_audit_logs(price_list_id);

CREATE INDEX IF NOT EXISTS idx_price_list_audit_logs_created_at 
  ON price_list_audit_logs(created_at DESC);