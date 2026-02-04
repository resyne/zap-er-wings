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
  '+49': 'Germania',
  '+41': 'Svizzera',
  '+1': 'USA',
  '0039': 'Italia',
  '0034': 'Spagna',
  '0044': 'UK',
  '0033': 'Francia',
  '0049': 'Germania',
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

// AI-powered field extraction
async function extractLeadFieldsWithAI(payload: any): Promise<{
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  notes: string | null;
  source: string;
  value: number | null;
  oven_type: string | null;
}> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    console.log('[AI-EXTRACT] No LOVABLE_API_KEY, falling back to manual extraction');
    return manualExtraction(payload);
  }

  try {
    console.log('[AI-EXTRACT] Calling AI to extract fields from:', JSON.stringify(payload));
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `Sei un assistente che estrae informazioni sui lead da payload JSON.
Analizza il payload e restituisci SOLO un oggetto JSON con questi campi:
- company_name: nome azienda (può essere null)
- contact_name: nome completo del contatto (combina first_name+last_name se separati)
- email: email del contatto
- phone: numero di telefono
- city: città/località
- notes: eventuali note o messaggi
- source: fonte del lead (es. "website", "form", ecc.)
- value: valore stimato se presente (numero)
- oven_type: tipo di forno se menzionato

Rispondi SOLO con il JSON, senza markdown o altro testo.`
          },
          {
            role: 'user',
            content: `Estrai i campi del lead da questo payload:\n${JSON.stringify(payload, null, 2)}`
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      console.error('[AI-EXTRACT] AI call failed:', response.status);
      return manualExtraction(payload);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';
    
    console.log('[AI-EXTRACT] AI response:', content);
    
    // Parse the JSON response
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const extracted = JSON.parse(cleanContent);
    
    console.log('[AI-EXTRACT] Extracted fields:', extracted);
    
    return {
      company_name: extracted.company_name || null,
      contact_name: extracted.contact_name || null,
      email: extracted.email || null,
      phone: extracted.phone || null,
      city: extracted.city || null,
      notes: extracted.notes || null,
      source: extracted.source || 'website',
      value: typeof extracted.value === 'number' ? extracted.value : null,
      oven_type: extracted.oven_type || null,
    };
  } catch (error) {
    console.error('[AI-EXTRACT] Error calling AI:', error);
    return manualExtraction(payload);
  }
}

// Fallback manual extraction
function manualExtraction(body: any): {
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  notes: string | null;
  source: string;
  value: number | null;
  oven_type: string | null;
} {
  const companyName = body.company_name || body.companyName || body.company || body.azienda || null;
  
  let contactName = body.contact_name || body.contactName || body.name || body.nome || body.full_name || body.customer_name || null;
  if (!contactName && (body.first_name || body.firstName)) {
    const firstName = body.first_name || body.firstName || '';
    const lastName = body.last_name || body.lastName || '';
    contactName = `${firstName} ${lastName}`.trim() || null;
  }
  
  const email = (body.email || body.email_address || '').trim() || null;
  const phone = body.phone || body.telefono || body.phone_number || body.cellulare || null;
  const city = body.luogo || body.location || body.citta || body.city || null;
  const notes = body.notes || body.note || body.message || body.messaggio || null;
  const source = body.source || body.fonte || 'website';
  const value = body.value || body.valore || body.budget || null;
  const ovenType = body.oven_type || body.ovenType || null;

  return {
    company_name: companyName,
    contact_name: contactName,
    email: email,
    phone: phone,
    city: city,
    notes: notes,
    source: source,
    value: typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) || null : value,
    oven_type: ovenType,
  };
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
        description: `Endpoint per ricevere lead esterni per la pipeline ${pipeline}. Usa AI per estrarre automaticamente i campi.`,
        usage: {
          method: 'POST',
          url: `${url.origin}${url.pathname}?pipeline=${pipeline}`,
          headers: {
            'Content-Type': 'application/json'
          },
          body: 'Qualsiasi JSON con informazioni sul lead - l\'AI estrarrà automaticamente i campi'
        },
        example: {
          company_name: 'Pizzeria Da Mario',
          contact_name: 'Mario Rossi',
          email: 'mario@pizzeria.it',
          phone: '+39 333 1234567',
          value: 15000,
          notes: 'Interessato a forno pizza',
          source: 'sito-vesuviano',
          city: 'Napoli'
        }
      };

      return new Response(
        JSON.stringify(docs, null, 2),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'POST') {
      const body = await req.json();
      console.log(`[WEBHOOK] Received external lead for ${pipeline}:`, JSON.stringify(body));

      // Use AI to extract fields (with fallback to manual extraction)
      const extracted = await extractLeadFieldsWithAI(body);
      console.log('[WEBHOOK] Extracted fields:', extracted);

      // Detect country from phone
      const detectedCountry = extracted.phone ? detectCountryFromPhone(extracted.phone) : null;

      // Build notes with additional info
      let fullNotes = extracted.notes ? `${extracted.notes}\n\nFonte: ${extracted.source}` : `Lead da ${extracted.source}`;
      if (extracted.oven_type) {
        fullNotes += `\nTipo forno: ${extracted.oven_type}`;
      }
      
      // Add raw payload for reference
      fullNotes += `\n\n--- Payload originale ---\n${JSON.stringify(body, null, 2)}`;

      // Prepare lead data
      const leadData: any = {
        company_name: extracted.company_name || extracted.contact_name || 'Lead da sito web',
        contact_name: extracted.contact_name,
        email: extracted.email,
        phone: extracted.phone,
        value: extracted.value,
        notes: fullNotes,
        source: extracted.source,
        pipeline: pipeline,
        status: 'new',
        country: detectedCountry || 'Italia',
        city: extracted.city
      };

      console.log('[WEBHOOK] Creating lead:', leadData);

      // Insert lead
      const { data, error } = await supabase
        .from('leads')
        .insert([leadData])
        .select();

      if (error) {
        console.error('[WEBHOOK] Error inserting lead:', error);
        return new Response(
          JSON.stringify({ error: 'Errore durante la creazione del lead', details: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[WEBHOOK] Lead created successfully:', data[0]);

      // If Vesuviano pipeline, sync with external configurator
      if (pipeline === 'Vesuviano' && data[0].email) {
        console.log('[WEBHOOK] Syncing Vesuviano lead with external configurator...');
        try {
          const syncResponse = await supabase.functions.invoke('sync-vesuviano-lead', {
            body: { leadId: data[0].id }
          });
          
          if (syncResponse.error) {
            console.error('[WEBHOOK] Error syncing with Vesuviano:', syncResponse.error);
          } else {
            console.log('[WEBHOOK] Vesuviano sync successful:', syncResponse.data);
          }
        } catch (syncError) {
          console.error('[WEBHOOK] Exception during Vesuviano sync:', syncError);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Lead creato con successo per pipeline ${pipeline}`,
          lead_id: data[0].id,
          extracted_fields: extracted,
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
    console.error('[WEBHOOK] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Errore interno del server', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
