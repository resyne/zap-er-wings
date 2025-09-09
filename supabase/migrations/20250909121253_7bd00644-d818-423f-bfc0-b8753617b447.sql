-- Add user assignment field for next activity
ALTER TABLE public.leads 
ADD COLUMN next_activity_assigned_to uuid;