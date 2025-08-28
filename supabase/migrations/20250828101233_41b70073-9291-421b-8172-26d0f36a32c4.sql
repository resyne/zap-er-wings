-- Secure any remaining tables that still have overly permissive policies

-- Secure remaining production/warehouse tables
DROP POLICY IF EXISTS "Allow authenticated users to view serials" ON public.serials;
DROP POLICY IF EXISTS "Allow authenticated users to insert serials" ON public.serials;
DROP POLICY IF EXISTS "Allow authenticated users to update serials" ON public.serials;
DROP POLICY IF EXISTS "Allow authenticated users to delete serials" ON public.serials;

CREATE POLICY "users_can_view_serials" ON public.serials FOR SELECT TO authenticated USING (public.has_minimum_role(auth.uid(), 'user'));
CREATE POLICY "moderators_can_manage_serials" ON public.serials FOR ALL TO authenticated USING (public.has_minimum_role(auth.uid(), 'moderator')) WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- Secure RMA table
DROP POLICY IF EXISTS "Allow authenticated users to view rma" ON public.rma;
DROP POLICY IF EXISTS "Allow authenticated users to insert rma" ON public.rma;
DROP POLICY IF EXISTS "Allow authenticated users to update rma" ON public.rma;
DROP POLICY IF EXISTS "Allow authenticated users to delete rma" ON public.rma;

CREATE POLICY "users_can_view_rma" ON public.rma FOR SELECT TO authenticated USING (public.has_minimum_role(auth.uid(), 'user'));
CREATE POLICY "users_can_create_rma" ON public.rma FOR INSERT TO authenticated WITH CHECK (public.has_minimum_role(auth.uid(), 'user'));
CREATE POLICY "moderators_can_manage_rma" ON public.rma FOR ALL TO authenticated USING (public.has_minimum_role(auth.uid(), 'moderator')) WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- Secure executions table
DROP POLICY IF EXISTS "Allow authenticated users to view executions" ON public.executions;
DROP POLICY IF EXISTS "Allow authenticated users to insert executions" ON public.executions;
DROP POLICY IF EXISTS "Allow authenticated users to update executions" ON public.executions;
DROP POLICY IF EXISTS "Allow authenticated users to delete executions" ON public.executions;

CREATE POLICY "users_can_view_executions" ON public.executions FOR SELECT TO authenticated USING (public.has_minimum_role(auth.uid(), 'user'));
CREATE POLICY "moderators_can_manage_executions" ON public.executions FOR ALL TO authenticated USING (public.has_minimum_role(auth.uid(), 'moderator')) WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- Secure companies table
DROP POLICY IF EXISTS "Allow authenticated users to view companies" ON public.companies;
DROP POLICY IF EXISTS "Allow authenticated users to insert companies" ON public.companies;
DROP POLICY IF EXISTS "Allow authenticated users to update companies" ON public.companies;
DROP POLICY IF EXISTS "Allow authenticated users to delete companies" ON public.companies;

CREATE POLICY "users_can_view_companies" ON public.companies FOR SELECT TO authenticated USING (public.has_minimum_role(auth.uid(), 'user'));
CREATE POLICY "moderators_can_manage_companies" ON public.companies FOR ALL TO authenticated USING (public.has_minimum_role(auth.uid(), 'moderator')) WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- Add service role access for these tables
CREATE POLICY "service_role_full_access_serials" ON public.serials FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_rma" ON public.rma FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_executions" ON public.executions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_companies" ON public.companies FOR ALL TO service_role USING (true) WITH CHECK (true);