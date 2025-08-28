-- Add notes column to recurring_subscriptions table
ALTER TABLE public.recurring_subscriptions 
ADD COLUMN notes text;