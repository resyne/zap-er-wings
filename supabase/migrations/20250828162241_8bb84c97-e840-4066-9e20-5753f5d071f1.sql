-- Add columns for regular and overtime hours to hr_timesheets table
ALTER TABLE public.hr_timesheets 
ADD COLUMN IF NOT EXISTS regular_hours numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS overtime_hours numeric DEFAULT 0;