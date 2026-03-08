
-- =====================================================
-- TIME & ATTENDANCE MODULE - Complete Database Schema
-- =====================================================

-- 1. GEOFENCES - Authorized zones for clock events
CREATE TABLE public.geofences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 100,
  location_type TEXT NOT NULL DEFAULT 'office', -- office, site, client
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. SHIFTS - Work shift definitions
CREATE TABLE public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_duration_minutes INTEGER NOT NULL DEFAULT 60,
  tolerance_late_minutes INTEGER NOT NULL DEFAULT 10,
  tolerance_early_minutes INTEGER NOT NULL DEFAULT 10,
  is_night_shift BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. EMPLOYEE_SHIFTS - Shift assignments
CREATE TABLE public.employee_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES public.shifts(id) ON DELETE CASCADE,
  valid_from DATE NOT NULL,
  valid_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. CLOCK_EVENTS - Core clock in/out events
CREATE TABLE public.clock_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- clock_in, clock_out, break_start, break_end
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  gps_lat DOUBLE PRECISION,
  gps_long DOUBLE PRECISION,
  gps_accuracy DOUBLE PRECISION,
  geofence_id UUID REFERENCES public.geofences(id),
  distance_from_workplace DOUBLE PRECISION,
  device_id TEXT,
  ip_address TEXT,
  note TEXT,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'valid', -- valid, anomaly, corrected
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. ATTENDANCE_DAYS - Daily attendance summary
CREATE TABLE public.attendance_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  first_clock_in TIMESTAMPTZ,
  last_clock_out TIMESTAMPTZ,
  total_work_minutes INTEGER DEFAULT 0,
  break_minutes INTEGER DEFAULT 0,
  overtime_minutes INTEGER DEFAULT 0,
  late_minutes INTEGER DEFAULT 0,
  early_exit_minutes INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'present', -- present, absent, holiday, leave, remote, travel
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date)
);

-- 6. OVERTIME_RECORDS - Overtime tracking
CREATE TABLE public.overtime_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  minutes INTEGER NOT NULL DEFAULT 0,
  overtime_type TEXT NOT NULL DEFAULT 'weekday', -- weekday, weekend, holiday, night
  approved_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. BREAK_RECORDS - Break tracking
CREATE TABLE public.break_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  break_start TIMESTAMPTZ NOT NULL,
  break_end TIMESTAMPTZ,
  break_type TEXT NOT NULL DEFAULT 'lunch', -- lunch, short, smoke
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. TRAVEL_RECORDS - Business travel/missions
CREATE TABLE public.travel_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  start_location TEXT,
  start_lat DOUBLE PRECISION,
  start_long DOUBLE PRECISION,
  destination TEXT,
  dest_lat DOUBLE PRECISION,
  dest_long DOUBLE PRECISION,
  distance_km DOUBLE PRECISION,
  purpose TEXT,
  client_name TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress', -- in_progress, completed, approved, rejected
  approved_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. LEAVE_REQUESTS - Absences/permits
CREATE TABLE public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL, -- ferie, malattia, permesso, rol, trasferta, smart_working
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  approved_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. ATTENDANCE_ANOMALIES - Auto-detected anomalies
CREATE TABLE public.attendance_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  anomaly_type TEXT NOT NULL, -- late, early_exit, missing_clock, long_break, gps_out_of_area
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'warning', -- info, warning, critical
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  clock_event_id UUID REFERENCES public.clock_events(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. ATTENDANCE_CORRECTIONS - Clock correction requests
CREATE TABLE public.attendance_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  original_event_id UUID REFERENCES public.clock_events(id),
  old_value TIMESTAMPTZ,
  requested_value TIMESTAMPTZ NOT NULL,
  event_type TEXT NOT NULL, -- clock_in, clock_out, break_start, break_end
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. HR_ATTENDANCE_SETTINGS - Policy settings
CREATE TABLE public.hr_attendance_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_clock_events_employee ON public.clock_events(employee_id, timestamp);
CREATE INDEX idx_clock_events_date ON public.clock_events(timestamp);
CREATE INDEX idx_attendance_days_employee ON public.attendance_days(employee_id, date);
CREATE INDEX idx_overtime_records_employee ON public.overtime_records(employee_id, date);
CREATE INDEX idx_break_records_employee ON public.break_records(employee_id, date);
CREATE INDEX idx_travel_records_employee ON public.travel_records(employee_id);
CREATE INDEX idx_leave_requests_employee ON public.leave_requests(employee_id);
CREATE INDEX idx_anomalies_employee ON public.attendance_anomalies(employee_id, date);
CREATE INDEX idx_corrections_employee ON public.attendance_corrections(employee_id, date);

-- Enable RLS on all tables
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clock_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.break_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_attendance_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Geofences: read for all authenticated, write for admin
CREATE POLICY "Authenticated users can read geofences" ON public.geofences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage geofences" ON public.geofences FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Shifts: read for all authenticated, write for admin
CREATE POLICY "Authenticated users can read shifts" ON public.shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage shifts" ON public.shifts FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Employee shifts: users see own, admin sees all
CREATE POLICY "Users see own shifts" ON public.employee_shifts FOR SELECT TO authenticated USING (employee_id = auth.uid() OR public.is_admin_user());
CREATE POLICY "Admins manage employee shifts" ON public.employee_shifts FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Clock events: users manage own, admin manages all
CREATE POLICY "Users see own clock events" ON public.clock_events FOR SELECT TO authenticated USING (employee_id = auth.uid() OR public.is_admin_user());
CREATE POLICY "Users insert own clock events" ON public.clock_events FOR INSERT TO authenticated WITH CHECK (employee_id = auth.uid());
CREATE POLICY "Admins manage all clock events" ON public.clock_events FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Attendance days: users see own, admin sees all
CREATE POLICY "Users see own attendance" ON public.attendance_days FOR SELECT TO authenticated USING (employee_id = auth.uid() OR public.is_admin_user());
CREATE POLICY "Admins manage attendance" ON public.attendance_days FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY "System inserts attendance" ON public.attendance_days FOR INSERT TO authenticated WITH CHECK (employee_id = auth.uid() OR public.is_admin_user());
CREATE POLICY "Users update own attendance" ON public.attendance_days FOR UPDATE TO authenticated USING (employee_id = auth.uid() OR public.is_admin_user());

-- Overtime records
CREATE POLICY "Users see own overtime" ON public.overtime_records FOR SELECT TO authenticated USING (employee_id = auth.uid() OR public.is_admin_user());
CREATE POLICY "Admins manage overtime" ON public.overtime_records FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Break records
CREATE POLICY "Users see own breaks" ON public.break_records FOR SELECT TO authenticated USING (employee_id = auth.uid() OR public.is_admin_user());
CREATE POLICY "Users insert own breaks" ON public.break_records FOR INSERT TO authenticated WITH CHECK (employee_id = auth.uid());
CREATE POLICY "Admins manage breaks" ON public.break_records FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Travel records
CREATE POLICY "Users see own travel" ON public.travel_records FOR SELECT TO authenticated USING (employee_id = auth.uid() OR public.is_admin_user());
CREATE POLICY "Users insert own travel" ON public.travel_records FOR INSERT TO authenticated WITH CHECK (employee_id = auth.uid());
CREATE POLICY "Users update own travel" ON public.travel_records FOR UPDATE TO authenticated USING (employee_id = auth.uid() OR public.is_admin_user());
CREATE POLICY "Admins manage travel" ON public.travel_records FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Leave requests
CREATE POLICY "Users see own leaves" ON public.leave_requests FOR SELECT TO authenticated USING (employee_id = auth.uid() OR public.is_admin_user());
CREATE POLICY "Users insert own leaves" ON public.leave_requests FOR INSERT TO authenticated WITH CHECK (employee_id = auth.uid());
CREATE POLICY "Users update own leaves" ON public.leave_requests FOR UPDATE TO authenticated USING (employee_id = auth.uid() OR public.is_admin_user());
CREATE POLICY "Admins manage leaves" ON public.leave_requests FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Attendance anomalies
CREATE POLICY "Users see own anomalies" ON public.attendance_anomalies FOR SELECT TO authenticated USING (employee_id = auth.uid() OR public.is_admin_user());
CREATE POLICY "Admins manage anomalies" ON public.attendance_anomalies FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Attendance corrections
CREATE POLICY "Users see own corrections" ON public.attendance_corrections FOR SELECT TO authenticated USING (employee_id = auth.uid() OR public.is_admin_user());
CREATE POLICY "Users insert own corrections" ON public.attendance_corrections FOR INSERT TO authenticated WITH CHECK (employee_id = auth.uid());
CREATE POLICY "Admins manage corrections" ON public.attendance_corrections FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- HR settings: read for all, write for admin
CREATE POLICY "Authenticated read settings" ON public.hr_attendance_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage settings" ON public.hr_attendance_settings FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Insert default settings
INSERT INTO public.hr_attendance_settings (setting_key, setting_value, description) VALUES
  ('overtime_threshold_daily', '{"minutes": 480}'::jsonb, 'Daily threshold for overtime in minutes (8h = 480)'),
  ('night_overtime_start', '{"time": "22:00"}'::jsonb, 'Start time for night overtime'),
  ('night_overtime_end', '{"time": "06:00"}'::jsonb, 'End time for night overtime'),
  ('mandatory_break_threshold', '{"work_minutes": 360, "break_minutes": 30}'::jsonb, 'Mandatory break after X work minutes'),
  ('weekend_days', '{"days": ["saturday", "sunday"]}'::jsonb, 'Weekend days for overtime calculation'),
  ('anomaly_long_break_minutes', '{"minutes": 90}'::jsonb, 'Break duration that triggers anomaly'),
  ('gps_required', '{"enabled": true}'::jsonb, 'Whether GPS is required for clock events'),
  ('selfie_required', '{"enabled": false}'::jsonb, 'Whether selfie is required for clock events');

-- Default shift
INSERT INTO public.shifts (name, start_time, end_time, break_duration_minutes, tolerance_late_minutes, tolerance_early_minutes) VALUES
  ('Turno Ufficio', '09:00', '18:00', 60, 10, 10),
  ('Turno Mattina', '06:00', '14:00', 30, 10, 10),
  ('Turno Pomeriggio', '14:00', '22:00', 30, 10, 10);
