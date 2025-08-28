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

-- SECURE HR TABLES (Employee data, salaries, personal info)
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Allow authenticated users to view employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Allow authenticated users to manage employees" ON public.hr_employees;
DROP POLICY IF EXISTS "Allow authenticated users to view timesheets" ON public.hr_timesheets;
DROP POLICY IF EXISTS "Allow authenticated users to manage timesheets" ON public.hr_timesheets;
DROP POLICY IF EXISTS "Allow authenticated users to view leave requests" ON public.hr_leave_requests;
DROP POLICY IF EXISTS "Allow authenticated users to manage leave requests" ON public.hr_leave_requests;

-- HR Employees - Only HR and Admin can access
CREATE POLICY "moderators_and_admins_can_view_employees" 
ON public.hr_employees FOR SELECT 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'moderator'));

CREATE POLICY "moderators_and_admins_can_manage_employees" 
ON public.hr_employees FOR ALL 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'moderator'))
WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- HR Timesheets - Only HR and Admin can access
CREATE POLICY "moderators_and_admins_can_view_timesheets" 
ON public.hr_timesheets FOR SELECT 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'moderator'));

CREATE POLICY "moderators_and_admins_can_manage_timesheets" 
ON public.hr_timesheets FOR ALL 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'moderator'))
WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- HR Leave Requests - Only HR and Admin can access
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
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Allow authenticated users to view customers" ON public.customers;
DROP POLICY IF EXISTS "Allow authenticated users to insert customers" ON public.customers;
DROP POLICY IF EXISTS "Allow authenticated users to update customers" ON public.customers;
DROP POLICY IF EXISTS "Allow authenticated users to delete customers" ON public.customers;

DROP POLICY IF EXISTS "Allow authenticated users to view quotes" ON public.quotes;
DROP POLICY IF EXISTS "Allow authenticated users to insert quotes" ON public.quotes;
DROP POLICY IF EXISTS "Allow authenticated users to update quotes" ON public.quotes;
DROP POLICY IF EXISTS "Allow authenticated users to delete quotes" ON public.quotes;

DROP POLICY IF EXISTS "Allow authenticated users to view sales_orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Allow authenticated users to insert sales_orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Allow authenticated users to update sales_orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Allow authenticated users to delete sales_orders" ON public.sales_orders;

-- Customers - Sales team and above can access
CREATE POLICY "sales_team_can_view_customers" 
ON public.customers FOR SELECT 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'user'));

CREATE POLICY "moderators_can_manage_customers" 
ON public.customers FOR ALL 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'moderator'))
WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- Quotes - Sales team can view/create, moderators can manage
CREATE POLICY "sales_team_can_view_quotes" 
ON public.quotes FOR SELECT 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'user'));

CREATE POLICY "sales_team_can_create_quotes" 
ON public.quotes FOR INSERT 
TO authenticated 
WITH CHECK (public.has_minimum_role(auth.uid(), 'user'));

CREATE POLICY "moderators_can_manage_quotes" 
ON public.quotes FOR ALL 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'moderator'))
WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- Sales Orders - Sales team can view/create, moderators can manage
CREATE POLICY "sales_team_can_view_sales_orders" 
ON public.sales_orders FOR SELECT 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'user'));

CREATE POLICY "sales_team_can_create_sales_orders" 
ON public.sales_orders FOR INSERT 
TO authenticated 
WITH CHECK (public.has_minimum_role(auth.uid(), 'user'));

CREATE POLICY "moderators_can_manage_sales_orders" 
ON public.sales_orders FOR ALL 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'moderator'))
WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- SECURE SUPPLIER AND PROCUREMENT TABLES
DROP POLICY IF EXISTS "Allow authenticated users to view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Allow authenticated users to insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Allow authenticated users to update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Allow authenticated users to delete suppliers" ON public.suppliers;

-- Suppliers - Procurement team and above
CREATE POLICY "procurement_team_can_view_suppliers" 
ON public.suppliers FOR SELECT 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'user'));

CREATE POLICY "moderators_can_manage_suppliers" 
ON public.suppliers FOR ALL 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'moderator'))
WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- SECURE CRM TABLES (already partially secured but need to verify)
-- CRM Deals - Sales team can access
DROP POLICY IF EXISTS "Allow authenticated users to view deals" ON public.crm_deals;
DROP POLICY IF EXISTS "Allow authenticated users to insert deals" ON public.crm_deals;
DROP POLICY IF EXISTS "Allow authenticated users to update deals" ON public.crm_deals;
DROP POLICY IF EXISTS "Allow authenticated users to delete deals" ON public.crm_deals;

CREATE POLICY "sales_team_can_view_deals" 
ON public.crm_deals FOR SELECT 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'user'));

CREATE POLICY "sales_team_can_manage_deals" 
ON public.crm_deals FOR ALL 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'user'))
WITH CHECK (public.has_minimum_role(auth.uid(), 'user'));

-- CRM Companies - Sales team can access
DROP POLICY IF EXISTS "Allow authenticated users to view companies" ON public.crm_companies;
DROP POLICY IF EXISTS "Allow authenticated users to insert companies" ON public.crm_companies;
DROP POLICY IF EXISTS "Allow authenticated users to update companies" ON public.crm_companies;
DROP POLICY IF EXISTS "Allow authenticated users to delete companies" ON public.crm_companies;

CREATE POLICY "sales_team_can_view_crm_companies" 
ON public.crm_companies FOR SELECT 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'user'));

CREATE POLICY "sales_team_can_manage_crm_companies" 
ON public.crm_companies FOR ALL 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'user'))
WITH CHECK (public.has_minimum_role(auth.uid(), 'user'));

-- CRM Notes - Sales team can access
DROP POLICY IF EXISTS "Allow authenticated users to view notes" ON public.crm_notes;
DROP POLICY IF EXISTS "Allow authenticated users to insert notes" ON public.crm_notes;
DROP POLICY IF EXISTS "Allow authenticated users to update notes" ON public.crm_notes;
DROP POLICY IF EXISTS "Allow authenticated users to delete notes" ON public.crm_notes;

CREATE POLICY "sales_team_can_view_notes" 
ON public.crm_notes FOR SELECT 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'user'));

CREATE POLICY "sales_team_can_manage_notes" 
ON public.crm_notes FOR ALL 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'user'))
WITH CHECK (public.has_minimum_role(auth.uid(), 'user'));

-- SECURE LEADS TABLE
DROP POLICY IF EXISTS "Allow authenticated users to view leads" ON public.leads;
DROP POLICY IF EXISTS "Allow authenticated users to insert leads" ON public.leads;
DROP POLICY IF EXISTS "Allow authenticated users to update leads" ON public.leads;
DROP POLICY IF EXISTS "Allow authenticated users to delete leads" ON public.leads;

CREATE POLICY "sales_team_can_view_leads" 
ON public.leads FOR SELECT 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'user'));

CREATE POLICY "sales_team_can_manage_leads" 
ON public.leads FOR ALL 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'user'))
WITH CHECK (public.has_minimum_role(auth.uid(), 'user'));

-- SECURE PRODUCTION TABLES
DROP POLICY IF EXISTS "Allow authenticated users to view boms" ON public.boms;
DROP POLICY IF EXISTS "Allow authenticated users to insert boms" ON public.boms;
DROP POLICY IF EXISTS "Allow authenticated users to update boms" ON public.boms;
DROP POLICY IF EXISTS "Allow authenticated users to delete boms" ON public.boms;

DROP POLICY IF EXISTS "Allow authenticated users to view bom_items" ON public.bom_items;
DROP POLICY IF EXISTS "Allow authenticated users to insert bom_items" ON public.bom_items;
DROP POLICY IF EXISTS "Allow authenticated users to update bom_items" ON public.bom_items;
DROP POLICY IF EXISTS "Allow authenticated users to delete bom_items" ON public.bom_items;

DROP POLICY IF EXISTS "Allow authenticated users to view items" ON public.items;
DROP POLICY IF EXISTS "Allow authenticated users to insert items" ON public.items;
DROP POLICY IF EXISTS "Allow authenticated users to update items" ON public.items;
DROP POLICY IF EXISTS "Allow authenticated users to delete items" ON public.items;

-- Production BOMs - Production team and above
CREATE POLICY "production_team_can_view_boms" 
ON public.boms FOR SELECT 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'user'));

CREATE POLICY "moderators_can_manage_boms" 
ON public.boms FOR ALL 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'moderator'))
WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- BOM Items - Production team can view, moderators can manage
CREATE POLICY "production_team_can_view_bom_items" 
ON public.bom_items FOR SELECT 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'user'));

CREATE POLICY "moderators_can_manage_bom_items" 
ON public.bom_items FOR ALL 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'moderator'))
WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- Items/Inventory - All users can view, moderators can manage
CREATE POLICY "users_can_view_items" 
ON public.items FOR SELECT 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'user'));

CREATE POLICY "moderators_can_manage_items" 
ON public.items FOR ALL 
TO authenticated 
USING (public.has_minimum_role(auth.uid(), 'moderator'))
WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- Keep service role access for all tables
CREATE POLICY "service_role_full_access_hr_employees" ON public.hr_employees FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_hr_timesheets" ON public.hr_timesheets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_hr_leave_requests" ON public.hr_leave_requests FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_customers" ON public.customers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_quotes" ON public.quotes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_sales_orders" ON public.sales_orders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_suppliers" ON public.suppliers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_crm_deals" ON public.crm_deals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_crm_companies" ON public.crm_companies FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_crm_notes" ON public.crm_notes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_leads" ON public.leads FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_boms" ON public.boms FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_bom_items" ON public.bom_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_items" ON public.items FOR ALL TO service_role USING (true) WITH CHECK (true);