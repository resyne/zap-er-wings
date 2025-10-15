-- Create lead_comments table
CREATE TABLE IF NOT EXISTS lead_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tagged_users UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE lead_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all lead comments"
  ON lead_comments
  FOR SELECT
  USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can create comments"
  ON lead_comments
  FOR INSERT
  WITH CHECK (
    has_minimum_role(auth.uid(), 'user'::app_role) 
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update their own comments"
  ON lead_comments
  FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete their own comments"
  ON lead_comments
  FOR DELETE
  USING (created_by = auth.uid());

CREATE POLICY "Service role full access"
  ON lead_comments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_lead_comments_lead_id ON lead_comments(lead_id);
CREATE INDEX idx_lead_comments_created_at ON lead_comments(created_at DESC);

-- Trigger to update updated_at
CREATE TRIGGER update_lead_comments_updated_at
  BEFORE UPDATE ON lead_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();