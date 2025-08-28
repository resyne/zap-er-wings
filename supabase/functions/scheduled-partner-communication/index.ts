import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Scheduled partner communication job started');

    // Get current date info
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentDate = now.getDate();

    // Monthly newsletter - send on 1st of each month
    if (currentDate === 1) {
      console.log('Sending monthly newsletter to all partners');
      
      const monthlySubject = "Newsletter Mensile Partnership - Aggiornamenti e Novità";
      const monthlyMessage = `Caro {partner_name},

Speriamo che questo messaggio ti trovi bene. Ecco gli aggiornamenti più importanti di questo mese per la nostra partnership con {company_name}:

📈 **Novità del Prodotto:**
- Nuove funzionalità rilasciate nel sistema di gestione partnership
- Miglioramenti nell'interfaccia di gestione dei materiali
- Nuove opzioni di reportistica e analytics

🎯 **Opportunità di Business:**
- Nuovi mercati disponibili per l'espansione
- Programmi di incentivi per il prossimo trimestre
- Eventi e fiere del settore in programma

📊 **Performance del Mese:**
- Aggiornamenti sui risultati della rete partnership
- Best practices condivise dai partner più performanti

🔧 **Supporto e Formazione:**
- Nuovi materiali di training disponibili
- Sessioni di formazione programmate per il prossimo mese
- FAQ aggiornate sul portal partner

Per qualsiasi domanda o per maggiori informazioni, non esitare a contattarci.

Grazie per essere un partner prezioso!`;

      await callSendEmailFunction({
        subject: monthlySubject,
        message: monthlyMessage,
        is_cronjob: true
      });
    }

    // Weekly check for importers - send on Mondays
    if (currentDay === 1) {
      console.log('Sending weekly check to importers');
      
      const weeklySubject = "Check Settimanale - Supporto Partnership";
      const weeklyMessage = `Ciao {partner_name},

Come va la settimana con {company_name}?

🔍 **Check Rapido:**
- Come stanno procedendo le attività di import?
- Ci sono nuove opportunità di mercato da valutare?
- Hai bisogno di supporto tecnico o commerciale?

💡 **Promemoria:**
- Non dimenticare di aggiornare i tuoi ordini nel sistema
- Controlla le nuove promozioni disponibili
- Rivedi i materiali di marketing aggiornati

Se hai bisogno di assistenza o hai domande, siamo qui per aiutarti.

Buona settimana!`;

      await callSendEmailFunction({
        partner_type: 'importatore',
        subject: weeklySubject,
        message: weeklyMessage,
        is_cronjob: true
      });
    }

    // Follow-up for new prospects - check for prospects older than 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: oldProspects, error: prospectError } = await supabase
      .from('partners')
      .select('id, first_name, last_name, email, company_name, partner_type')
      .eq('acquisition_status', 'prospect')
      .lt('created_at', sevenDaysAgo.toISOString())
      .not('email', 'is', null);

    if (!prospectError && oldProspects && oldProspects.length > 0) {
      console.log(`Found ${oldProspects.length} prospects for follow-up`);
      
      const followUpSubject = "Follow-up Partnership - Opportunità di Collaborazione";
      const followUpMessage = `Caro {partner_name},

Abbiamo notato il tuo interesse verso una possibile partnership con noi per {company_name}.

🤝 **Vogliamo aiutarti a crescere:**
- Supporto dedicato per l'avvio della partnership
- Materiali di training personalizzati
- Condizioni commerciali competitive
- Accesso prioritario alle novità

📞 **Prossimi Passi:**
Siamo pronti a programmare una chiamata per discutere:
- Le tue esigenze specifiche
- Le opportunità del tuo mercato
- Il nostro supporto per il tuo successo

Non lasciare che questa opportunità ti sfugga!

Contattaci per fissare un appuntamento.`;

      // Send individual emails to prospects
      for (const prospect of oldProspects) {
        try {
          await callSendEmailFunction({
            subject: followUpSubject,
            message: followUpMessage.replace(
              /\{partner_name\}/g, 
              `${prospect.first_name} ${prospect.last_name}`
            ).replace(
              /\{company_name\}/g,
              prospect.company_name
            ),
            is_cronjob: true
          }, [prospect.email]);
        } catch (error) {
          console.error(`Failed to send follow-up to ${prospect.email}:`, error);
        }
      }
    }

    console.log('Scheduled partner communication job completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Scheduled communications sent successfully',
        timestamp: now.toISOString()
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in scheduled-partner-communication:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

// Helper function to call the send-partner-emails function
async function callSendEmailFunction(emailData: any, specificEmails?: string[]) {
  try {
    const response = await supabase.functions.invoke('send-partner-emails', {
      body: emailData
    });
    
    if (response.error) {
      throw response.error;
    }
    
    console.log('Email function called successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error calling send-partner-emails function:', error);
    throw error;
  }
}

serve(handler);