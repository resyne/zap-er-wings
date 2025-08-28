-- Fix function search path security issue by setting search_path explicitly for existing functions
ALTER FUNCTION public.set_updated_at() SET search_path = 'public';
ALTER FUNCTION public.auto_generate_sales_order_number() SET search_path = 'public';
ALTER FUNCTION public.generate_sales_order_number() SET search_path = 'public';
ALTER FUNCTION public.create_work_order_from_opportunity() SET search_path = 'public';
ALTER FUNCTION public.generate_quote_code() SET search_path = 'public';
ALTER FUNCTION public.create_quote_code_for_custom_quote() SET search_path = 'public';
ALTER FUNCTION public.handle_new_user() SET search_path = 'public';