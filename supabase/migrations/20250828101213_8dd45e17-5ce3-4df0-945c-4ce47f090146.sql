-- Complete the remaining security fixes for tables that need additional policies

-- SECURE PRODUCTION EXECUTION TABLES
DROP POLICY IF EXISTS "Allow authenticated users to view executions" ON public.executions;
DROP POLICY IF EXISTS "Allow authenticated users to insert executions" ON public.executions;
DROP POLICY IF EXISTS "Allow authenticated users to update executions" ON public.executions;
DROP POLICY IF EXISTS "Allow authenticated users to delete executions" ON public.executions;

CREATE POLICY "users_can_view_executions" ON public.executions FOR SELECT TO authenticated USING (public.has_minimum_role(auth.uid(), 'user'));
CREATE POLICY "moderators_can_manage_executions" ON public.executions FOR ALL TO authenticated USING (public.has_minimum_role(auth.uid(), 'moderator')) WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- SECURE SERIALS TABLE
DROP POLICY IF EXISTS "Allow authenticated users to view serials" ON public.serials;
DROP POLICY IF EXISTS "Allow authenticated users to insert serials" ON public.serials;
DROP POLICY IF EXISTS "Allow authenticated users to update serials" ON public.serials;
DROP POLICY IF EXISTS "Allow authenticated users to delete serials" ON public.serials;

CREATE POLICY "users_can_view_serials" ON public.serials FOR SELECT TO authenticated USING (public.has_minimum_role(auth.uid(), 'user'));
CREATE POLICY "moderators_can_manage_serials" ON public.serials FOR ALL TO authenticated USING (public.has_minimum_role(auth.uid(), 'moderator')) WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- SECURE RMA TABLE
DROP POLICY IF EXISTS "Allow authenticated users to view rma" ON public.rma;
DROP POLICY IF EXISTS "Allow authenticated users to insert rma" ON public.rma;
DROP POLICY IF EXISTS "Allow authenticated users to update rma" ON public.rma;
DROP POLICY IF EXISTS "Allow authenticated users to delete rma" ON public.rma;

CREATE POLICY "users_can_view_rma" ON public.rma FOR SELECT TO authenticated USING (public.has_minimum_role(auth.uid(), 'user'));
CREATE POLICY "moderators_can_manage_rma" ON public.rma FOR ALL TO authenticated USING (public.has_minimum_role(auth.uid(), 'moderator')) WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- SECURE COMPANIES TABLE (internal company data)
DROP POLICY IF EXISTS "Allow authenticated users to view companies" ON public.companies;
DROP POLICY IF EXISTS "Allow authenticated users to insert companies" ON public.companies;
DROP POLICY IF EXISTS "Allow authenticated users to update companies" ON public.companies;
DROP POLICY IF EXISTS "Allow authenticated users to delete companies" ON public.companies;

CREATE POLICY "users_can_view_companies" ON public.companies FOR SELECT TO authenticated USING (public.has_minimum_role(auth.uid(), 'user'));
CREATE POLICY "moderators_can_manage_companies" ON public.companies FOR ALL TO authenticated USING (public.has_minimum_role(auth.uid(), 'moderator')) WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- SECURE OPPORTUNITY ACTIVITIES TABLE
DROP POLICY IF EXISTS "Allow authenticated users to view activities" ON public.opportunity_activities;
DROP POLICY IF EXISTS "Allow authenticated users to insert activities" ON public.opportunity_activities;
DROP POLICY IF EXISTS "Allow authenticated users to update activities" ON public.opportunity_activities;
DROP POLICY IF EXISTS "Allow authenticated users to delete activities" ON public.opportunity_activities;

CREATE POLICY "users_can_view_activities" ON public.opportunity_activities FOR SELECT TO authenticated USING (public.has_minimum_role(auth.uid(), 'user'));
CREATE POLICY "users_can_manage_activities" ON public.opportunity_activities FOR ALL TO authenticated USING (public.has_minimum_role(auth.uid(), 'user')) WITH CHECK (public.has_minimum_role(auth.uid(), 'user'));

-- SECURE OPPORTUNITY FILES TABLE
DROP POLICY IF EXISTS "Allow authenticated users to delete files" ON public.opportunity_files;

CREATE POLICY "users_can_view_opportunity_files" ON public.opportunity_files FOR SELECT TO authenticated USING (public.has_minimum_role(auth.uid(), 'user'));
CREATE POLICY "users_can_manage_opportunity_files" ON public.opportunity_files FOR ALL TO authenticated USING (public.has_minimum_role(auth.uid(), 'user')) WITH CHECK (public.has_minimum_role(auth.uid(), 'user'));

-- Add service role access for remaining tables
CREATE POLICY "service_role_full_access_executions" ON public.executions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_serials" ON public.serials FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_rma" ON public.rma FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_companies" ON public.companies FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_opportunity_activities" ON public.opportunity_activities FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_opportunity_files" ON public.opportunity_files FOR ALL TO service_role USING (true) WITH CHECK (true);