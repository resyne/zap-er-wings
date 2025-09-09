-- Create newsletter templates table
CREATE TABLE public.newsletter_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  logo_url TEXT,
  header_text TEXT NOT NULL DEFAULT 'Newsletter Aziendale',
  footer_text TEXT NOT NULL DEFAULT '© 2024 La Tua Azienda. Tutti i diritti riservati.',
  signature TEXT NOT NULL DEFAULT 'Cordiali saluti,\nIl Team Marketing',
  attachments JSONB DEFAULT '[]'::jsonb,
  is_default BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.newsletter_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for newsletter templates
CREATE POLICY "Users can view newsletter templates" 
ON public.newsletter_templates 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create newsletter templates" 
ON public.newsletter_templates 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own newsletter templates" 
ON public.newsletter_templates 
FOR UPDATE 
USING (auth.uid() = created_by);

CREATE POLICY "Admins can manage all newsletter templates" 
ON public.newsletter_templates 
FOR ALL 
USING (is_admin_user());

-- Create trigger for updated_at
CREATE TRIGGER update_newsletter_templates_updated_at
BEFORE UPDATE ON public.newsletter_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default templates
INSERT INTO public.newsletter_templates (name, description, subject, message, header_text, footer_text, signature, is_default) VALUES
(
  'Newsletter Mensile Standard',
  'Template per newsletter informative mensili',
  'Newsletter {company_name} - Aggiornamenti del Mese',
  'Caro {partner_name},

Ecco gli aggiornamenti più importanti di questo mese:

📢 **Novità Prodotti:**
- Nuovi modelli disponibili
- Aggiornamenti di gamma
- Promozioni in corso

📈 **Opportunità di Business:**
- Nuovi mercati disponibili
- Programmi di incentivi
- Eventi in programma

Grazie per essere un partner prezioso!',
  'Newsletter Mensile',
  '© 2024 La Tua Azienda. Tutti i diritti riservati.\nSe non desideri più ricevere queste email, puoi disiscriverti.',
  'Cordiali saluti,\nIl Team Marketing\nLa Tua Azienda',
  true
),
(
  'Follow-up Prospect',
  'Template per ricontattare potenziali clienti',
  'Follow-up Partnership - Opportunità di Collaborazione',
  'Caro {partner_name},

Abbiamo notato il tuo interesse verso una possibile partnership con {company_name}.

🤝 **Vogliamo aiutarti a crescere:**
- Supporto dedicato per l''avvio
- Materiali di training personalizzati
- Condizioni commerciali competitive

📞 **Prossimi Passi:**
Siamo pronti a programmare una chiamata per discutere le tue esigenze.

Contattaci per fissare un appuntamento.',
  'Collaborazione Commerciale',
  '© 2024 La Tua Azienda. Tutti i diritti riservati.',
  'Cordiali saluti,\nIl Team Vendite\nLa Tua Azienda',
  false
),
(
  'Promozione Prodotti',
  'Template per promozioni e offerte speciali',
  '🎉 Offerta Speciale - {company_name}',
  'Caro {partner_name},

Abbiamo un''offerta speciale pensata appositamente per te!

🎯 **Promozione del Mese:**
- Sconti fino al 30% su prodotti selezionati
- Condizioni di pagamento agevolate
- Consegna gratuita per ordini superiori a €500

⏰ **Affrettati!**
L''offerta è valida fino alla fine del mese.

Non perdere questa opportunità!',
  'Offerte Speciali',
  '© 2024 La Tua Azienda. Tutti i diritti riservati.\nOfferta valida fino al 31/12/2024.',
  'Cordiali saluti,\nIl Team Commerciale\nLa Tua Azienda',
  false
);