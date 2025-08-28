-- First check and update the app_role enum to include moderator
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'moderator';

-- Helper function to check if user has minimum required role
CREATE OR REPLACE FUNCTION public.has_minimum_role(_user_id uuid, _min_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE _min_role
    WHEN 'user' THEN EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = _user_id 
      AND role IN ('user', 'moderator', 'admin')
    )
    WHEN 'moderator' THEN EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = _user_id 
      AND role IN ('moderator', 'admin')
    )
    WHEN 'admin' THEN EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = _user_id 
      AND role = 'admin'
    )
    ELSE false
  END;
$$;

-- SECURE HR TABLES (Employee data, salaries, personal info)
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Allow authenticated users to view employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Allow authenticated users to manage employees" ON public.hr_employees;

-- HR Employees - Only moderators and admins can access
CREATE POLICY "moderators_and_admins_can_view_employees" 
ON public.hr_employees FOR SELECT 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'moderator'));

CREATE POLICY "moderators_and_admins_can_manage_employees" 
ON public.hr_employees FOR ALL 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'moderator'))
WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- HR Timesheets
DROP POLICY IF EXISTS "Allow authenticated users to view timesheets" ON public.hr_timesheets;
DROP POLICY IF EXISTS "Allow authenticated users to manage timesheets" ON public.hr_timesheets;

CREATE POLICY "moderators_and_admins_can_view_timesheets" 
ON public.hr_timesheets FOR SELECT 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'moderator'));

CREATE POLICY "moderators_and_admins_can_manage_timesheets" 
ON public.hr_timesheets FOR ALL 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'moderator'))
WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- HR Leave Requests  
DROP POLICY IF EXISTS "Allow authenticated users to view leave requests" ON public.hr_leave_requests;
DROP POLICY IF EXISTS "Allow authenticated users to manage leave requests" ON public.hr_leave_requests;

CREATE POLICY "moderators_and_admins_can_view_leave_requests" 
ON public.hr_leave_requests FOR SELECT 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'moderator'));

CREATE POLICY "moderators_and_admins_can_manage_leave_requests" 
ON public.hr_leave_requests FOR ALL 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'moderator'))
WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- SECURE CUSTOMER AND FINANCIAL TABLES
DROP POLICY IF EXISTS "Allow authenticated users to view customers" ON public.customers;
DROP POLICY IF EXISTS "Allow authenticated users to insert customers" ON public.customers;
DROP POLICY IF EXISTS "Allow authenticated users to update customers" ON public.customers;
DROP POLICY IF EXISTS "Allow authenticated users to delete customers" ON public.customers;

-- Customers - Users can view, moderators can manage
CREATE POLICY "users_can_view_customers" 
ON public.customers FOR SELECT 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'user'));

CREATE POLICY "moderators_can_manage_customers" 
ON public.customers FOR ALL 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'moderator'))
WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- Add service role access for all secured tables
CREATE POLICY "service_role_full_access_hr_employees" ON public.hr_employees FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_hr_timesheets" ON public.hr_timesheets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_hr_leave_requests" ON public.hr_leave_requests FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_customers" ON public.customers FOR ALL TO service_role USING (true) WITH CHECK (true);