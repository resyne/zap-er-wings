
-- Table to track monitoring alerts and avoid duplicates
CREATE TABLE public.system_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type TEXT NOT NULL,
  alert_message TEXT NOT NULL,
  details JSONB,
  severity TEXT NOT NULL DEFAULT 'warning',
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view alerts" ON public.system_alerts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "System can insert alerts" ON public.system_alerts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update alerts" ON public.system_alerts
  FOR UPDATE TO authenticated USING (true);

-- Index for quick lookups
CREATE INDEX idx_system_alerts_type_created ON public.system_alerts(alert_type, created_at DESC);
CREATE INDEX idx_system_alerts_resolved ON public.system_alerts(resolved, created_at DESC);

-- Table to track monitoring state (thresholds, last check times)
CREATE TABLE public.system_monitor_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_monitor_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage config" ON public.system_monitor_config
  FOR ALL TO authenticated USING (true);

-- Insert default thresholds
INSERT INTO public.system_monitor_config (config_key, config_value) VALUES
  ('sync_loop_threshold', '{"max_syncs_per_hour": 50, "enabled": true}'::jsonb),
  ('api_consumption_threshold', '{"max_calls_per_hour": 200, "enabled": true}'::jsonb),
  ('edge_function_error_threshold', '{"max_errors_per_hour": 10, "enabled": true}'::jsonb),
  ('alert_email', '{"email": "stanislaoelefante@gmail.com"}'::jsonb);
