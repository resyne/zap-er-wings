import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Function to call Lovable AI for lead interpretation
async function interpretLeadWithAI(leadData: any) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.error('LOVABLE_API_KEY not configured');
    return null;
  }

  try {
    const prompt = `Analizza questo lead proveniente da Facebook e fornisci una classificazione intelligente:

Dati ricevuti:
- Nome completo: ${leadData.fullName || 'N/A'}
- Email: ${leadData.email || 'N/A'}
- Telefono: ${leadData.phone || 'N/A'}
- Campagna: ${leadData.campaign || 'N/A'}
- Fonte: ${leadData.source || 'Facebook'}

Estrai e fornisci:
1. company_name: Nome dell'azienda (se identificabile dal nome o email, altrimenti usa il nome completo)
2. contact_name: Nome del contatto
3. pipeline: "Vesuviano" se la campagna contiene "Vesuviano", altrimenti "ZAPPER"
4. estimated_value: Stima il valore potenziale in euro (basato sulla tipologia di prodotto)
5. notes: Breve nota contestualizzata sulla provenienza del lead e campagna

Rispondi in formato JSON puro senza markdown.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Sei un assistente AI esperto nella qualificazione di lead commerciali. Rispondi sempre con JSON valido senza markdown.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    // Parse AI response (remove markdown if present)
    let parsed;
    try {
      const cleaned = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('Error parsing AI response:', aiResponse);
      return null;
    }

    console.log('AI interpretation:', parsed);
    return parsed;
  } catch (error) {
    console.error('Error calling AI:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    if (req.method === 'POST') {
      const body = await req.json()
      
      console.log('Received Zapier webhook:', body)

      // Extract raw data from Facebook Lead Ads via Zapier
      const rawData = {
        fullName: body['Full Name'] || body.full_name || body.name || null,
        email: (body['Email '] || body.email || body.email_address || '').trim(),
        phone: body.Telefono || body.telefono || body.phone || body.phone_number || null,
        campaign: body.Campagna || body.campagna || body.campaign || null,
        source: body.Fonte || body.fonte || body.source || 'facebook',
      }

      console.log('Extracted raw data:', rawData)

      // Call AI to interpret and enrich the lead data
      const aiInterpretation = await interpretLeadWithAI(rawData)
      
      // Prepare lead data with AI enrichment
      const leadData: any = {
        company_name: aiInterpretation?.company_name || rawData.fullName || 'Lead Facebook',
        contact_name: aiInterpretation?.contact_name || rawData.fullName || null,
        email: rawData.email || null,
        phone: rawData.phone || null,
        value: aiInterpretation?.estimated_value || null,
        source: 'facebook',
        status: 'new', // Status "new" per far apparire il badge giallo
        pipeline: aiInterpretation?.pipeline || (rawData.campaign?.toLowerCase().includes('vesuviano') ? 'Vesuviano' : 'ZAPPER'),
        notes: aiInterpretation?.notes || `Lead da campagna Facebook: ${rawData.campaign || 'N/A'}`,
        country: 'Italia',
      }

      console.log('Final lead data:', leadData)

      // Convert value to number if it's a string
      if (leadData.value && typeof leadData.value === 'string') {
        const numericValue = parseFloat(leadData.value.replace(/[^\d.-]/g, ''))
        leadData.value = isNaN(numericValue) ? null : numericValue
      }

      // Insert lead into database
      const { data, error } = await supabase
        .from('leads')
        .insert([leadData])
        .select()

      if (error) {
        console.error('Error inserting lead:', error)
        return new Response(
          JSON.stringify({ 
            error: 'Errore durante l\'inserimento del lead', 
            details: error.message 
          }),
          { 
            status: 500, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json' 
            } 
          }
        )
      }

      console.log('Lead created successfully:', data[0])

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Lead creato con successo da Zapier',
          lead_id: data[0].id,
          lead_data: data[0]
        }),
        { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      )
    }

    if (req.method === 'GET') {
      // Return API documentation
      const docs = {
        message: 'Zapier Lead Webhook API',
        description: 'Endpoint per ricevere lead da Zapier',
        usage: {
          method: 'POST',
          url: `${req.url}`,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            company_name: 'Nome dell\'azienda (obbligatorio)',
            contact_name: 'Nome del contatto (opzionale)',
            email: 'Email del contatto (opzionale)',
            phone: 'Telefono del contatto (opzionale)',
            value: 'Valore stimato del lead (opzionale)',
            notes: 'Note aggiuntive (opzionale)'
          }
        },
        alternative_field_names: {
          company_name: ['company', 'business_name', 'organization'],
          contact_name: ['name', 'full_name', 'first_name + last_name'],
          email: ['email_address'],
          phone: ['phone_number', 'mobile'],
          value: ['deal_value', 'amount', 'budget'],
          notes: ['message', 'description', 'comments']
        },
        example: {
          company_name: 'ABC S.r.l.',
          contact_name: 'Mario Rossi',
          email: 'mario@abc.it',
          phone: '+39 123 456 7890',
          value: 15000,
          notes: 'Lead interessato ai nostri servizi'
        }
      }

      return new Response(
        JSON.stringify(docs, null, 2),
        { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json' 
          } 
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Metodo non supportato' }),
      { 
        status: 405, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Errore interno del server', 
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})