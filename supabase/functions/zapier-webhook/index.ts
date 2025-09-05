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
      
      console.log('Received Zapier webhook data:', body)

      // Get the webhook type from query parameters or body
      const url = new URL(req.url)
      const webhookType = url.searchParams.get('type') || body.webhook_type || 'general'

      // Store the webhook data in a generic webhooks table or process based on type
      const webhookData = {
        webhook_type: webhookType,
        data: body,
        source: 'zapier',
        processed: false,
        received_at: new Date().toISOString(),
      }

      // Process based on webhook type
      let result = null
      
      switch (webhookType.toLowerCase()) {
        case 'lead':
        case 'leads':
          result = await processLeadWebhook(supabase, body)
          break
        
        case 'customer':
        case 'customers':
          result = await processCustomerWebhook(supabase, body)
          break
        
        case 'contact':
        case 'contacts':
          result = await processContactWebhook(supabase, body)
          break
        
        default:
          // Store as general webhook data for manual processing
          const { data, error } = await supabase
            .from('webhook_logs')
            .insert([webhookData])
            .select()

          if (error) {
            console.error('Error storing webhook data:', error)
            return new Response(
              JSON.stringify({ 
                error: 'Errore durante il salvataggio dei dati webhook', 
                details: error.message 
              }),
              { 
                status: 500, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            )
          }

          result = {
            success: true,
            message: 'Dati webhook ricevuti e memorizzati',
            webhook_id: data[0].id,
            webhook_type: webhookType
          }
      }

      return new Response(
        JSON.stringify(result),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (req.method === 'GET') {
      // Return API documentation
      const docs = {
        message: 'Zapier Generic Webhook API',
        description: 'Endpoint generico per ricevere dati da Zapier',
        endpoint: `${req.url}`,
        usage: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          parameters: {
            type: 'Tipo di webhook (lead, customer, contact, general) - query param o nel body'
          }
        },
        supported_types: {
          lead: 'Crea un nuovo lead nel CRM',
          customer: 'Crea un nuovo cliente',
          contact: 'Crea un nuovo contatto CRM',
          general: 'Salva i dati per processamento manuale'
        },
        examples: {
          lead: {
            url: `${req.url}?type=lead`,
            body: {
              company_name: 'ABC S.r.l.',
              contact_name: 'Mario Rossi',
              email: 'mario@abc.it',
              phone: '+39 123 456 7890',
              value: 15000,
              notes: 'Lead interessato ai nostri servizi'
            }
          },
          customer: {
            url: `${req.url}?type=customer`,
            body: {
              name: 'Mario Rossi',
              company_name: 'ABC S.r.l.',
              email: 'mario@abc.it',
              phone: '+39 123 456 7890',
              address: 'Via Roma 123, Milano'
            }
          },
          contact: {
            url: `${req.url}?type=contact`,
            body: {
              first_name: 'Mario',
              last_name: 'Rossi',
              email: 'mario@abc.it',
              phone: '+39 123 456 7890',
              company_name: 'ABC S.r.l.'
            }
          }
        }
      }

      return new Response(
        JSON.stringify(docs, null, 2),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Metodo non supportato' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

// Process lead webhook data
async function processLeadWebhook(supabase: any, body: any) {
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

  // Convert value to number if it's a string
  if (leadData.value && typeof leadData.value === 'string') {
    const numericValue = parseFloat(leadData.value.replace(/[^\d.-]/g, ''))
    leadData.value = isNaN(numericValue) ? null : numericValue
  }

  const { data, error } = await supabase
    .from('leads')
    .insert([leadData])
    .select()

  if (error) {
    throw new Error(`Errore durante l'inserimento del lead: ${error.message}`)
  }

  return {
    success: true,
    message: 'Lead creato con successo da Zapier',
    lead_id: data[0].id,
    data: data[0]
  }
}

// Process customer webhook data
async function processCustomerWebhook(supabase: any, body: any) {
  const customerData = {
    name: body.name || body.customer_name || body.full_name || (body.first_name && body.last_name ? `${body.first_name} ${body.last_name}` : body.first_name) || 'Cliente sconosciuto',
    company_name: body.company_name || body.company || body.business_name || body.organization || null,
    email: body.email || body.email_address || null,
    phone: body.phone || body.phone_number || body.mobile || null,
    address: body.address || body.billing_address || null,
    shipping_address: body.shipping_address || null,
    city: body.city || null,
    country: body.country || null,
    tax_id: body.tax_id || body.vat_number || body.piva || null,
    active: true
  }

  const { data, error } = await supabase
    .from('customers')
    .insert([customerData])
    .select()

  if (error) {
    throw new Error(`Errore durante l'inserimento del cliente: ${error.message}`)
  }

  return {
    success: true,
    message: 'Cliente creato con successo da Zapier',
    customer_id: data[0].id,
    data: data[0]
  }
}

// Process contact webhook data
async function processContactWebhook(supabase: any, body: any) {
  const contactData = {
    first_name: body.first_name || body.name?.split(' ')[0] || null,
    last_name: body.last_name || (body.name?.split(' ').slice(1).join(' ')) || null,
    email: body.email || body.email_address || null,
    phone: body.phone || body.phone_number || null,
    mobile: body.mobile || body.mobile_phone || null,
    company_name: body.company_name || body.company || body.business_name || body.organization || null,
    job_title: body.job_title || body.position || body.role || null,
    lead_source: 'zapier'
  }

  const { data, error } = await supabase
    .from('crm_contacts')
    .insert([contactData])
    .select()

  if (error) {
    throw new Error(`Errore durante l'inserimento del contatto: ${error.message}`)
  }

  return {
    success: true,
    message: 'Contatto CRM creato con successo da Zapier',
    contact_id: data[0].id,
    data: data[0]
  }
}