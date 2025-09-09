-- Add next_activity field to leads table
ALTER TABLE public.leads 
ADD COLUMN next_activity_type text,
ADD COLUMN next_activity_date timestamp with time zone,
ADD COLUMN next_activity_notes text;