-- Fix search path for remaining functions
ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = 'public';
ALTER FUNCTION public.has_minimum_role(uuid, app_role) SET search_path = 'public';
ALTER FUNCTION public.validate_quote_code(text) SET search_path = 'public';
ALTER FUNCTION public.get_quote_by_code(text) SET search_path = 'public';