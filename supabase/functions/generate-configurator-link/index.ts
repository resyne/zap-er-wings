import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
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

    console.log('Generating configurator link for lead:', leadId)

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single()

    if (leadError || !lead) {
      throw new Error('Lead not found')
    }

    // Check if lead is in vesuviano pipeline
    if (lead.pipeline !== 'vesuviano') {
      throw new Error('This function only works for vesuviano pipeline leads')
    }

    // If link already exists, return it
    if (lead.external_configurator_link) {
      console.log('Link already exists:', lead.external_configurator_link)
      return new Response(
        JSON.stringify({ 
          success: true, 
          link: lead.external_configurator_link,
          isExisting: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // TODO: Replace with your actual configurator site URL
    const CONFIGURATOR_API_URL = Deno.env.get('CONFIGURATOR_API_URL') || 'https://YOUR_OTHER_SITE.lovable.app/api/create-link'

    // Call the external configurator API to generate a link
    console.log('Calling external API:', CONFIGURATOR_API_URL)
    
    const response = await fetch(CONFIGURATOR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        leadId: lead.id,
        leadName: lead.name,
        email: lead.email,
        company: lead.company,
        pipeline: lead.pipeline,
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('External API error:', errorText)
      throw new Error(`External API returned ${response.status}: ${errorText}`)
    }

    const { uniqueCode, link } = await response.json()
    
    if (!uniqueCode || !link) {
      throw new Error('Invalid response from external API')
    }

    console.log('Received link from external API:', link)

    // Update the lead with the generated link
    const { error: updateError } = await supabase
      .from('leads')
      .update({ external_configurator_link: link })
      .eq('id', leadId)

    if (updateError) {
      console.error('Error updating lead:', updateError)
      throw updateError
    }

    console.log('Successfully generated and saved configurator link')

    return new Response(
      JSON.stringify({ 
        success: true, 
        link,
        uniqueCode,
        isExisting: false 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error generating configurator link:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
