import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { leadId } = await req.json()
    
    if (!leadId) {
      throw new Error('leadId is required')
    }

    console.log('Syncing Vesuviano lead:', leadId)

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single()

    if (leadError || !lead) {
      console.error('Lead not found:', leadError)
      throw new Error('Lead not found')
    }

    // Only sync if pipeline is vesuviano
    if (lead.pipeline?.toLowerCase() !== 'vesuviano') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Lead is not in vesuviano pipeline' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prepare data for external API
    const apiData = {
      name: lead.contact_name || lead.company_name || 'Nome non specificato',
      email: lead.email || '',
      phone: lead.phone || '',
      pipeline_id: lead.id,
      price_list: 'A' // Default price list
    }

    console.log('Calling external API with data:', apiData)

    // Call external webhook
    const apiKey = Deno.env.get('VESUVIANO_API_KEY')
    if (!apiKey) {
      throw new Error('VESUVIANO_API_KEY not configured')
    }

    const response = await fetch(
      'https://lgueucxznbqgvhpjzurf.supabase.co/functions/v1/import-lead-from-erp',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify(apiData)
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('External API error:', response.status, errorText)
      throw new Error(`External API returned ${response.status}: ${errorText}`)
    }

    const result = await response.json()
    console.log('External API response:', result)

    // Save configurator link to lead if available
    if (result.configurator_link) {
      const { error: updateError } = await supabase
        .from('leads')
        .update({ 
          external_configurator_link: result.configurator_link 
        })
        .eq('id', leadId)

      if (updateError) {
        console.error('Error updating lead with configurator link:', updateError)
      } else {
        console.log('Saved configurator link to lead')
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        configurator_link: result.configurator_link,
        session_id: result.session_id,
        token: result.token
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error syncing Vesuviano lead:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
