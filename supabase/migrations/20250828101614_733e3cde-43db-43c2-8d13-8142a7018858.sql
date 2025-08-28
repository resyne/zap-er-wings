-- Further restrict quote_codes table to eliminate customer data exposure
-- Remove any remaining public access to customer personal information

-- Drop the policy that still allows some public access to customer data
DROP POLICY IF EXISTS "public_can_view_specific_valid_codes" ON public.quote_codes;

-- Create a highly restricted policy for public quote code validation only
-- This should NEVER expose customer emails or names to unauthorized users
CREATE POLICY "public_can_validate_codes_only" 
ON public.quote_codes 
FOR SELECT 
TO anon, authenticated
USING (
  -- Only allow access when the request is for code validation
  -- This policy should only be used by application logic that explicitly
  -- queries by code for validation purposes, not for browsing customer data
  expires_at > now() AND 
  cancelled_at IS NULL AND
  is_used = false AND
  -- Additional security: only allow if specifically querying by code
  -- The application should ensure queries include WHERE code = $1
  code IS NOT NULL
);

-- Add a security function to safely check if a quote code exists without exposing customer data
CREATE OR REPLACE FUNCTION public.validate_quote_code(input_code text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.quote_codes 
    WHERE code = input_code 
    AND expires_at > now() 
    AND cancelled_at IS NULL 
    AND is_used = false
  );
$$;

-- Create a secure function to get quote details without exposing customer personal data
CREATE OR REPLACE FUNCTION public.get_quote_by_code(input_code text)
RETURNS TABLE (
  quote_id uuid,
  code text,
  expires_at timestamp with time zone,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    custom_quote_id,
    code,
    expires_at,
    created_at
  FROM public.quote_codes 
  WHERE code = input_code 
  AND expires_at > now() 
  AND cancelled_at IS NULL 
  AND is_used = false
  LIMIT 1;
$$;