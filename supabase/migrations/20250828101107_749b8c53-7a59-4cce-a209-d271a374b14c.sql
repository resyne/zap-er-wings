-- Continue securing remaining sensitive tables

-- SECURE SUPPLIER AND PROCUREMENT TABLES
DROP POLICY IF EXISTS "Allow authenticated users to view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Allow authenticated users to insert suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Allow authenticated users to update suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Allow authenticated users to delete suppliers" ON public.suppliers;

CREATE POLICY "users_can_view_suppliers" ON public.suppliers FOR SELECT TO authenticated USING (public.has_minimum_role(auth.uid(), 'user'));
CREATE POLICY "moderators_can_manage_suppliers" ON public.suppliers FOR ALL TO authenticated USING (public.has_minimum_role(auth.uid(), 'moderator')) WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- SECURE CRM TABLES
DROP POLICY IF EXISTS "Allow authenticated users to view deals" ON public.crm_deals;
DROP POLICY IF EXISTS "Allow authenticated users to insert deals" ON public.crm_deals;
DROP POLICY IF EXISTS "Allow authenticated users to update deals" ON public.crm_deals;
DROP POLICY IF EXISTS "Allow authenticated users to delete deals" ON public.crm_deals;

CREATE POLICY "users_can_view_deals" ON public.crm_deals FOR SELECT TO authenticated USING (public.has_minimum_role(auth.uid(), 'user'));
CREATE POLICY "users_can_manage_deals" ON public.crm_deals FOR ALL TO authenticated USING (public.has_minimum_role(auth.uid(), 'user')) WITH CHECK (public.has_minimum_role(auth.uid(), 'user'));

-- CRM Companies
DROP POLICY IF EXISTS "Allow authenticated users to view companies" ON public.crm_companies;
DROP POLICY IF EXISTS "Allow authenticated users to insert companies" ON public.crm_companies;
DROP POLICY IF EXISTS "Allow authenticated users to update companies" ON public.crm_companies;
DROP POLICY IF EXISTS "Allow authenticated users to delete companies" ON public.crm_companies;

CREATE POLICY "users_can_view_crm_companies" ON public.crm_companies FOR SELECT TO authenticated USING (public.has_minimum_role(auth.uid(), 'user'));
CREATE POLICY "users_can_manage_crm_companies" ON public.crm_companies FOR ALL TO authenticated USING (public.has_minimum_role(auth.uid(), 'user')) WITH CHECK (public.has_minimum_role(auth.uid(), 'user'));

-- CRM Notes
DROP POLICY IF EXISTS "Allow authenticated users to view notes" ON public.crm_notes;
DROP POLICY IF EXISTS "Allow authenticated users to insert notes" ON public.crm_notes;
DROP POLICY IF EXISTS "Allow authenticated users to update notes" ON public.crm_notes;
DROP POLICY IF EXISTS "Allow authenticated users to delete notes" ON public.crm_notes;

CREATE POLICY "users_can_view_notes" ON public.crm_notes FOR SELECT TO authenticated USING (public.has_minimum_role(auth.uid(), 'user'));
CREATE POLICY "users_can_manage_notes" ON public.crm_notes FOR ALL TO authenticated USING (public.has_minimum_role(auth.uid(), 'user')) WITH CHECK (public.has_minimum_role(auth.uid(), 'user'));

-- SECURE LEADS TABLE
DROP POLICY IF EXISTS "Allow authenticated users to view leads" ON public.leads;
DROP POLICY IF EXISTS "Allow authenticated users to insert leads" ON public.leads;
DROP POLICY IF EXISTS "Allow authenticated users to update leads" ON public.leads;
DROP POLICY IF EXISTS "Allow authenticated users to delete leads" ON public.leads;

CREATE POLICY "users_can_view_leads" ON public.leads FOR SELECT TO authenticated USING (public.has_minimum_role(auth.uid(), 'user'));
CREATE POLICY "users_can_manage_leads" ON public.leads FOR ALL TO authenticated USING (public.has_minimum_role(auth.uid(), 'user')) WITH CHECK (public.has_minimum_role(auth.uid(), 'user'));

-- SECURE PRODUCTION TABLES - Only moderators can manage, users can view
DROP POLICY IF EXISTS "Allow authenticated users to view boms" ON public.boms;
DROP POLICY IF EXISTS "Allow authenticated users to insert boms" ON public.boms;
DROP POLICY IF EXISTS "Allow authenticated users to update boms" ON public.boms;
DROP POLICY IF EXISTS "Allow authenticated users to delete boms" ON public.boms;

CREATE POLICY "users_can_view_boms" ON public.boms FOR SELECT TO authenticated USING (public.has_minimum_role(auth.uid(), 'user'));
CREATE POLICY "moderators_can_manage_boms" ON public.boms FOR ALL TO authenticated USING (public.has_minimum_role(auth.uid(), 'moderator')) WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- BOM Items
DROP POLICY IF EXISTS "Allow authenticated users to view bom_items" ON public.bom_items;
DROP POLICY IF EXISTS "Allow authenticated users to insert bom_items" ON public.bom_items;
DROP POLICY IF EXISTS "Allow authenticated users to update bom_items" ON public.bom_items;
DROP POLICY IF EXISTS "Allow authenticated users to delete bom_items" ON public.bom_items;

CREATE POLICY "users_can_view_bom_items" ON public.bom_items FOR SELECT TO authenticated USING (public.has_minimum_role(auth.uid(), 'user'));
CREATE POLICY "moderators_can_manage_bom_items" ON public.bom_items FOR ALL TO authenticated USING (public.has_minimum_role(auth.uid(), 'moderator')) WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- Items/Inventory
DROP POLICY IF EXISTS "Allow authenticated users to view items" ON public.items;
DROP POLICY IF EXISTS "Allow authenticated users to insert items" ON public.items;
DROP POLICY IF EXISTS "Allow authenticated users to update items" ON public.items;
DROP POLICY IF EXISTS "Allow authenticated users to delete items" ON public.items;

CREATE POLICY "users_can_view_items" ON public.items FOR SELECT TO authenticated USING (public.has_minimum_role(auth.uid(), 'user'));
CREATE POLICY "moderators_can_manage_items" ON public.items FOR ALL TO authenticated USING (public.has_minimum_role(auth.uid(), 'moderator')) WITH CHECK (public.has_minimum_role(auth.uid(), 'moderator'));

-- Add service role access for remaining tables
CREATE POLICY "service_role_full_access_suppliers" ON public.suppliers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_crm_deals" ON public.crm_deals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_crm_companies" ON public.crm_companies FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_crm_notes" ON public.crm_notes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_leads" ON public.leads FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_boms" ON public.boms FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_bom_items" ON public.bom_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_items" ON public.items FOR ALL TO service_role USING (true) WITH CHECK (true);