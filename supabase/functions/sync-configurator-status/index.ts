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

    const VESUVIANO_API_KEY = Deno.env.get('VESUVIANO_API_KEY')
    if (!VESUVIANO_API_KEY) {
      throw new Error('VESUVIANO_API_KEY not configured')
    }

    // Get all Vesuviano leads with external configurator link
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, company_name, external_configurator_link, configurator_opened')
      .eq('pipeline', 'Vesuviano')
      .not('external_configurator_link', 'is', null)

    if (leadsError) {
      throw leadsError
    }

    console.log(`[SYNC-CONFIGURATOR-STATUS] Found ${leads?.length || 0} Vesuviano leads to check`)

    let updatedCount = 0
    const results: any[] = []

    for (const lead of leads || []) {
      try {
        // Extract session ID from the configurator link
        const urlMatch = lead.external_configurator_link?.match(/\/configuratore\/([a-f0-9-]+)/)
        if (!urlMatch) {
          console.log(`[SYNC-CONFIGURATOR-STATUS] No session ID found in URL for lead ${lead.id}`)
          continue
        }
        
        const externalSessionId = urlMatch[1]
        
        // Call the external Vesuviano API to get session status
        const response = await fetch(`https://lgueucxznbqgvhpjzurf.supabase.co/functions/v1/get-session-status?session_id=${externalSessionId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': VESUVIANO_API_KEY
          }
        })

        if (!response.ok) {
          console.log(`[SYNC-CONFIGURATOR-STATUS] API error for lead ${lead.id}: ${response.status}`)
          continue
        }

        const sessionData = await response.json()
        console.log(`[SYNC-CONFIGURATOR-STATUS] Session data for ${lead.company_name}:`, JSON.stringify(sessionData))

        // Check if configurator was opened
        if (sessionData.is_used || sessionData.link_opened) {
          const { error: updateError } = await supabase
            .from('leads')
            .update({
              configurator_opened: true,
              configurator_opened_at: sessionData.last_opened_at || new Date().toISOString(),
              configurator_last_updated: new Date().toISOString()
            })
            .eq('id', lead.id)

          if (!updateError) {
            updatedCount++
            results.push({
              id: lead.id,
              company_name: lead.company_name,
              updated: true
            })
            console.log(`[SYNC-CONFIGURATOR-STATUS] Updated lead ${lead.company_name} as opened`)
          }
        } else {
          results.push({
            id: lead.id,
            company_name: lead.company_name,
            updated: false,
            reason: 'not_opened'
          })
        }

      } catch (leadError) {
        console.error(`[SYNC-CONFIGURATOR-STATUS] Error processing lead ${lead.id}:`, leadError)
        results.push({
          id: lead.id,
          company_name: lead.company_name,
          updated: false,
          error: leadError.message
        })
      }
    }

    console.log(`[SYNC-CONFIGURATOR-STATUS] Completed. Updated ${updatedCount} leads.`)

    return new Response(JSON.stringify({
      success: true,
      total_leads: leads?.length || 0,
      updated_count: updatedCount,
      results
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[SYNC-CONFIGURATOR-STATUS] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
