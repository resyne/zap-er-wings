-- Enable RLS and create policies for GL Entry tables
ALTER TABLE public.gl_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gl_entry_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;

-- Policies for gl_entry table
CREATE POLICY "Users can view gl entries" ON public.gl_entry
FOR SELECT USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can create gl entries" ON public.gl_entry
FOR INSERT WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can update gl entries" ON public.gl_entry
FOR UPDATE USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Moderators can delete gl entries" ON public.gl_entry
FOR DELETE USING (has_minimum_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Service role full access gl_entry" ON public.gl_entry
FOR ALL USING (true) WITH CHECK (true);

-- Policies for gl_entry_line table
CREATE POLICY "Users can view gl entry lines" ON public.gl_entry_line
FOR SELECT USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can create gl entry lines" ON public.gl_entry_line
FOR INSERT WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can update gl entry lines" ON public.gl_entry_line
FOR UPDATE USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Moderators can delete gl entry lines" ON public.gl_entry_line
FOR DELETE USING (has_minimum_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Service role full access gl_entry_line" ON public.gl_entry_line
FOR ALL USING (true) WITH CHECK (true);

-- Policies for customer_invoices table
CREATE POLICY "Users can view customer invoices" ON public.customer_invoices
FOR SELECT USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can create customer invoices" ON public.customer_invoices
FOR INSERT WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Moderators can update customer invoices" ON public.customer_invoices
FOR UPDATE USING (has_minimum_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Moderators can delete customer invoices" ON public.customer_invoices
FOR DELETE USING (has_minimum_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Service role full access customer_invoices" ON public.customer_invoices
FOR ALL USING (true) WITH CHECK (true);

-- Policies for supplier_invoices table
CREATE POLICY "Users can view supplier invoices" ON public.supplier_invoices
FOR SELECT USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can create supplier invoices" ON public.supplier_invoices
FOR INSERT WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Moderators can update supplier invoices" ON public.supplier_invoices
FOR UPDATE USING (has_minimum_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Moderators can delete supplier invoices" ON public.supplier_invoices
FOR DELETE USING (has_minimum_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Service role full access supplier_invoices" ON public.supplier_invoices
FOR ALL USING (true) WITH CHECK (true);