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
    console.log('[SYNC-ALL-VESUVIANO] Starting bulk sync...')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get all Vesuviano leads without external_configurator_link
    const { data: leads, error: fetchError } = await supabase
      .from('leads')
      .select('*')
      .eq('pipeline', 'Vesuviano')
      .is('external_configurator_link', null)

    if (fetchError) {
      console.error('[SYNC-ALL-VESUVIANO] Error fetching leads:', fetchError)
      throw fetchError
    }

    if (!leads || leads.length === 0) {
      console.log('[SYNC-ALL-VESUVIANO] No leads to sync')
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No leads to sync',
        synced: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[SYNC-ALL-VESUVIANO] Found ${leads.length} leads to sync`)

    const vesuvianoApiKey = Deno.env.get('VESUVIANO_API_KEY')
    if (!vesuvianoApiKey) {
      throw new Error('VESUVIANO_API_KEY not configured')
    }

    const results = {
      total: leads.length,
      synced: 0,
      failed: 0,
      errors: [] as any[]
    }

    // Process each lead one by one
    for (const lead of leads) {
      try {
        console.log(`[SYNC-ALL-VESUVIANO] Syncing lead ${lead.id} - ${lead.company_name || lead.contact_name}`)

        // Prepare API data
        const apiData = {
          contact_name: lead.contact_name || lead.company_name || 'Cliente',
          email: lead.email || '',
          phone: lead.phone || '',
          company_name: lead.company_name || '',
          pipeline_id: lead.pipeline || 'vesuviano',
          price_list: 'standard',
          erp_webhook_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/configurator-webhook`,
          erp_lead_id: lead.id
        }

        // Call external API
        const response = await fetch(
          'https://lgueucxznbqgvhpjzurf.supabase.co/functions/v1/import-lead-from-erp',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': vesuvianoApiKey
            },
            body: JSON.stringify(apiData)
          }
        )

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`API error: ${response.status} - ${errorText}`)
        }

        const result = await response.json()
        console.log(`[SYNC-ALL-VESUVIANO] API response for lead ${lead.id}:`, result)

        // Update lead with configurator link and session
        const { error: updateError } = await supabase
          .from('leads')
          .update({
            external_configurator_link: result.configurator_link,
            configurator_session_id: result.session_id,
            configurator_link: result.configurator_link,
            updated_at: new Date().toISOString()
          })
          .eq('id', lead.id)

        if (updateError) {
          console.error(`[SYNC-ALL-VESUVIANO] Error updating lead ${lead.id}:`, updateError)
          throw updateError
        }

        results.synced++
        console.log(`[SYNC-ALL-VESUVIANO] Successfully synced lead ${lead.id}`)

        // Small delay to avoid overwhelming the external API
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (error) {
        console.error(`[SYNC-ALL-VESUVIANO] Failed to sync lead ${lead.id}:`, error)
        results.failed++
        results.errors.push({
          lead_id: lead.id,
          lead_name: lead.company_name || lead.contact_name,
          error: error.message
        })
      }
    }

    console.log('[SYNC-ALL-VESUVIANO] Sync complete:', results)

    return new Response(JSON.stringify({
      success: true,
      ...results
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[SYNC-ALL-VESUVIANO] Error:', error)
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
