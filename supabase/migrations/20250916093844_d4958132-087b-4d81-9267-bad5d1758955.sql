-- Remove unique constraint on email column to allow same email with different names
ALTER TABLE public.sender_emails 
DROP CONSTRAINT IF EXISTS sender_emails_email_unique;