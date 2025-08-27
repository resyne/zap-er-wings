-- Crea tabelle per l'integrazione Fluida HR
CREATE TABLE public.hr_employees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fluida_id text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  department text,
  position text,
  hire_date date,
  status text DEFAULT 'active',
  salary numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  synced_at timestamp with time zone
);

-- Abilita RLS
ALTER TABLE public.hr_employees ENABLE ROW LEVEL SECURITY;

-- Policy per autenticati
CREATE POLICY "Allow authenticated users to view employees" 
ON public.hr_employees 
FOR SELECT 
USING (true);

CREATE POLICY "Allow authenticated users to manage employees" 
ON public.hr_employees 
FOR ALL 
USING (true);

-- Tabella per timesheet/presenze
CREATE TABLE public.hr_timesheets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  fluida_timesheet_id text,
  date date NOT NULL,
  clock_in timestamp with time zone,
  clock_out timestamp with time zone,
  break_minutes integer DEFAULT 0,
  total_hours numeric,
  status text DEFAULT 'pending',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  synced_at timestamp with time zone
);

-- Abilita RLS per timesheet
ALTER TABLE public.hr_timesheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view timesheets" 
ON public.hr_timesheets 
FOR SELECT 
USING (true);

CREATE POLICY "Allow authenticated users to manage timesheets" 
ON public.hr_timesheets 
FOR ALL 
USING (true);

-- Tabella per ferie/permessi
CREATE TABLE public.hr_leave_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id uuid NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  fluida_request_id text,
  leave_type text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_requested numeric NOT NULL,
  status text DEFAULT 'pending',
  reason text,
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  synced_at timestamp with time zone
);

-- Abilita RLS per leave requests
ALTER TABLE public.hr_leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view leave requests" 
ON public.hr_leave_requests 
FOR SELECT 
USING (true);

CREATE POLICY "Allow authenticated users to manage leave requests" 
ON public.hr_leave_requests 
FOR ALL 
USING (true);

-- Trigger per aggiornare updated_at
CREATE TRIGGER update_hr_employees_updated_at
BEFORE UPDATE ON public.hr_employees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hr_timesheets_updated_at
BEFORE UPDATE ON public.hr_timesheets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hr_leave_requests_updated_at
BEFORE UPDATE ON public.hr_leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Indici per performance
CREATE INDEX idx_hr_employees_fluida_id ON public.hr_employees(fluida_id);
CREATE INDEX idx_hr_timesheets_employee_date ON public.hr_timesheets(employee_id, date);
CREATE INDEX idx_hr_leave_requests_employee ON public.hr_leave_requests(employee_id);
CREATE INDEX idx_hr_leave_requests_dates ON public.hr_leave_requests(start_date, end_date);