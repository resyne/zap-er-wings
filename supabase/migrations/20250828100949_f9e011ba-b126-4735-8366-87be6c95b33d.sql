-- Implement role-based access controls for sensitive business data
-- Fix overly permissive RLS policies that expose sensitive information

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

-- SECURE HR TABLES (Employee data, salaries, personal info) - Only moderators/admins
DROP POLICY IF EXISTS "Allow authenticated users to view employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Allow authenticated users to manage employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Allow authenticated users to view timesheets" ON public.hr_timesheets;
DROP POLICY IF EXISTS "Allow authenticated users to manage timesheets" ON public.hr_timesheets;
DROP POLICY IF EXISTS "Allow authenticated users to view leave requests" ON public.hr_leave_requests;
DROP POLICY IF EXISTS "Allow authenticated users to manage leave requests" ON public.hr_leave_requests;

CREATE POLICY "moderators_and_admins_can_view_employees" ON public.hr_employees FOR SELECT TO authenticated USING (public.has_minimum_role(auth.uid(), 'moderator'));
CREATE POLICY "moderators_and_admins_can_manage_employees" ON public.hr_employees FOR ALL TO authenticated USING (public.has_minimum_role(auth.uid(), 'moderator')) WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));
CREATE POLICY "moderators_and_admins_can_view_timesheets" ON public.hr_timesheets FOR SELECT TO authenticated USING (public.has_minimum_role(auth.uid(), 'moderator'));
CREATE POLICY "moderators_and_admins_can_manage_timesheets" ON public.hr_timesheets FOR ALL TO authenticated USING (public.has_minimum_role(auth.uid(), 'moderator')) WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));
CREATE POLICY "moderators_and_admins_can_view_leave_requests" ON public.hr_leave_requests FOR SELECT TO authenticated USING (public.has_minimum_role(auth.uid(), 'moderator'));
CREATE POLICY "moderators_and_admins_can_manage_leave_requests" ON public.hr_leave_requests FOR ALL TO authenticated USING (public.has_minimum_role(auth.uid(), 'moderator')) WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- SECURE CUSTOMER AND FINANCIAL TABLES
DROP POLICY IF EXISTS "Allow authenticated users to view customers" ON public.customers;
DROP POLICY IF EXISTS "Allow authenticated users to insert customers" ON public.customers;
DROP POLICY IF EXISTS "Allow authenticated users to update customers" ON public.customers;
DROP POLICY IF EXISTS "Allow authenticated users to delete customers" ON public.customers;

CREATE POLICY "users_can_view_customers" ON public.customers FOR SELECT TO authenticated USING (public.has_minimum_role(auth.uid(), 'user'));
CREATE POLICY "moderators_can_manage_customers" ON public.customers FOR ALL TO authenticated USING (public.has_minimum_role(auth.uid(), 'moderator')) WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- SECURE QUOTES TABLE
DROP POLICY IF EXISTS "Allow authenticated users to view quotes" ON public.quotes;
DROP POLICY IF EXISTS "Allow authenticated users to insert quotes" ON public.quotes;
DROP POLICY IF EXISTS "Allow authenticated users to update quotes" ON public.quotes;
DROP POLICY IF EXISTS "Allow authenticated users to delete quotes" ON public.quotes;

CREATE POLICY "users_can_view_quotes" ON public.quotes FOR SELECT TO authenticated USING (public.has_minimum_role(auth.uid(), 'user'));
CREATE POLICY "users_can_create_quotes" ON public.quotes FOR INSERT TO authenticated WITH CHECK (public.has_minimum_role(auth.uid(), 'user'));
CREATE POLICY "moderators_can_manage_quotes" ON public.quotes FOR ALL TO authenticated USING (public.has_minimum_role(auth.uid(), 'moderator')) WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- SECURE SALES ORDERS
DROP POLICY IF EXISTS "Allow authenticated users to view sales_orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Allow authenticated users to insert sales_orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Allow authenticated users to update sales_orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Allow authenticated users to delete sales_orders" ON public.sales_orders;

CREATE POLICY "users_can_view_sales_orders" ON public.sales_orders FOR SELECT TO authenticated USING (public.has_minimum_role(auth.uid(), 'user'));
CREATE POLICY "users_can_create_sales_orders" ON public.sales_orders FOR INSERT TO authenticated WITH CHECK (public.has_minimum_role(auth.uid(), 'user'));
CREATE POLICY "moderators_can_manage_sales_orders" ON public.sales_orders FOR ALL TO authenticated USING (public.has_minimum_role(auth.uid(), 'moderator')) WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- Add service role access for all secured tables
CREATE POLICY "service_role_full_access_hr_employees" ON public.hr_employees FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_hr_timesheets" ON public.hr_timesheets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_hr_leave_requests" ON public.hr_leave_requests FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_customers" ON public.customers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_quotes" ON public.quotes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_sales_orders" ON public.sales_orders FOR ALL TO service_role USING (true) WITH CHECK (true);