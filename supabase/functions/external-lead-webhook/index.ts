import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// Country detection from phone prefix
const prefixMap: { [key: string]: string } = {
  '+39': 'Italia',
  '+34': 'Spagna',
  '+44': 'UK',
  '+33': 'Francia',
  '0039': 'Italia',
  '0034': 'Spagna',
  '0044': 'UK',
  '0033': 'Francia',
};

function detectCountryFromPhone(phone: string): string | null {
  if (!phone) return null;
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  for (const [prefix, country] of Object.entries(prefixMap)) {
    if (cleanPhone.startsWith(prefix)) {
      return country;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get pipeline from URL params
    const url = new URL(req.url);
    const pipeline = url.searchParams.get('pipeline');

    if (!pipeline || !['Vesuviano', 'ZAPPER'].includes(pipeline)) {
      return new Response(
        JSON.stringify({ 
          error: 'Pipeline non valida. Usa ?pipeline=Vesuviano o ?pipeline=ZAPPER' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'GET') {
      // Return API documentation
      const docs = {
        message: `External Lead Webhook - Pipeline: ${pipeline}`,
        description: `Endpoint per ricevere lead esterni per la pipeline ${pipeline}`,
        usage: {
          method: 'POST',
          url: `${url.origin}${url.pathname}?pipeline=${pipeline}`,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            company_name: 'Nome azienda (opzionale)',
            contact_name: 'Nome contatto (opzionale)',
            email: 'Email (opzionale)',
            phone: 'Telefono (opzionale)',
            value: 'Valore stimato (opzionale)',
            notes: 'Note (opzionale)',
            source: 'Fonte del lead (opzionale, default: website)',
            luogo: 'Località (opzionale)'
          }
        },
        example: {
          company_name: 'Pizzeria Da Mario',
          contact_name: 'Mario Rossi',
          email: 'mario@pizzeria.it',
          phone: '+39 333 1234567',
          value: 15000,
          notes: 'Interessato a forno pizza',
          source: 'sito-vesuviano',
          luogo: 'Napoli'
        }
      };

      return new Response(
        JSON.stringify(docs, null, 2),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST') {
      const body = await req.json();
      console.log(`Received external lead for ${pipeline}:`, body);

      // Extract lead data with flexible field names
      const companyName = body.company_name || body.companyName || body.company || body.azienda || null;
      const contactName = body.contact_name || body.contactName || body.name || body.nome || body.full_name || null;
      const email = (body.email || body.email_address || '').trim() || null;
      const phone = body.phone || body.telefono || body.phone_number || body.cellulare || null;
      const value = body.value || body.valore || body.budget || null;
      const notes = body.notes || body.note || body.message || body.messaggio || null;
      const source = body.source || body.fonte || 'website';
      const luogo = body.luogo || body.location || body.citta || body.city || null;

      // Detect country from phone
      const detectedCountry = phone ? detectCountryFromPhone(phone) : null;

      // Prepare lead data
      const leadData: any = {
        company_name: companyName || contactName || 'Lead da sito web',
        contact_name: contactName,
        email: email,
        phone: phone,
        value: typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) || null : value,
        notes: notes ? `${notes}\n\nFonte: ${source}` : `Lead da ${source}`,
        source: source,
        pipeline: pipeline,
        status: 'new',
        country: detectedCountry || 'Italia',
        luogo: luogo
      };

      console.log('Creating lead:', leadData);

      // Insert lead
      const { data, error } = await supabase
        .from('leads')
        .insert([leadData])
        .select();

      if (error) {
        console.error('Error inserting lead:', error);
        return new Response(
          JSON.stringify({ error: 'Errore durante la creazione del lead', details: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Lead created successfully:', data[0]);

      // If Vesuviano pipeline, sync with external configurator
      if (pipeline === 'Vesuviano' && data[0].email) {
        console.log('Syncing Vesuviano lead with external configurator...');
        try {
          const syncResponse = await supabase.functions.invoke('sync-vesuviano-lead', {
            body: { leadId: data[0].id }
          });
          
          if (syncResponse.error) {
            console.error('Error syncing with Vesuviano:', syncResponse.error);
          } else {
            console.log('Vesuviano sync successful:', syncResponse.data);
          }
        } catch (syncError) {
          console.error('Exception during Vesuviano sync:', syncError);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Lead creato con successo per pipeline ${pipeline}`,
          lead_id: data[0].id,
          lead: data[0]
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Metodo non supportato' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Errore interno del server', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
