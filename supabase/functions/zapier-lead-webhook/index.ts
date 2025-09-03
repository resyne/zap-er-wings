import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

      // Extract lead data from Zapier payload
      // Zapier might send data in different formats, so we'll handle common patterns
      const leadData = {
        company_name: body.company_name || body.company || body.business_name || body.organization || 'Azienda sconosciuta',
        contact_name: body.contact_name || body.name || body.full_name || (body.first_name && body.last_name ? `${body.first_name} ${body.last_name}` : body.first_name) || null,
        email: body.email || body.email_address || null,
        phone: body.phone || body.phone_number || body.mobile || null,
        value: body.value || body.deal_value || body.amount || body.budget || null,
        source: 'zapier',
        status: 'new',
        notes: body.notes || body.message || body.description || body.comments || null,
      }

      // Validate required fields
      if (!leadData.company_name) {
        return new Response(
          JSON.stringify({ 
            error: 'Campo obbligatorio mancante: company_name',
            received_data: body 
          }),
          { 
            status: 400, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json' 
            } 
          }
        )
      }

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