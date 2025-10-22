-- Add new fields to offers table for better tracking
ALTER TABLE public.offers 
ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
ADD COLUMN payment_terms TEXT;

-- Create index for better performance on assigned_to lookups
CREATE INDEX idx_offers_assigned_to ON public.offers(assigned_to);

-- Add comment for documentation
COMMENT ON COLUMN public.offers.assigned_to IS 'User responsible for preparing the offer';
COMMENT ON COLUMN public.offers.priority IS 'Urgency level of the offer request';
COMMENT ON COLUMN public.offers.payment_terms IS 'Payment conditions (e.g., "Alla consegna", custom text)';