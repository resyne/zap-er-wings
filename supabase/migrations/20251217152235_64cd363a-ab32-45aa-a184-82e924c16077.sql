-- Remove the check constraint that limits training_type values
ALTER TABLE public.safety_training_records 
DROP CONSTRAINT IF EXISTS safety_training_records_training_type_check;