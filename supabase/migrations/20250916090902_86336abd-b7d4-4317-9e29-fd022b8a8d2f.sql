-- Add unique constraint on email column
ALTER TABLE public.sender_emails 
ADD CONSTRAINT sender_emails_email_unique UNIQUE (email);