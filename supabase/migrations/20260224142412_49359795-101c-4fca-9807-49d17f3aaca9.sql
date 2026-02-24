
-- Add z_app_only column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS z_app_only boolean NOT NULL DEFAULT false;
