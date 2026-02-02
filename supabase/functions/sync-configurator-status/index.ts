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

    const ERP_API_KEY = Deno.env.get('VESUVIANO_API_KEY')
    if (!ERP_API_KEY) {
      throw new Error('VESUVIANO_API_KEY not configured')
    }

    // Call the external API to get all session updates
    console.log('[SYNC-CONFIGURATOR-STATUS] Fetching session updates from Vesuviano...')
    
    const response = await fetch('https://lgueucxznbqgvhpjzurf.supabase.co/functions/v1/get-session-updates', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ERP_API_KEY
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[SYNC-CONFIGURATOR-STATUS] API error:', response.status, errorText)
      throw new Error(`External API error: ${response.status}`)
    }

    const data = await response.json()
    const sessions = data.sessions || data
    console.log(`[SYNC-CONFIGURATOR-STATUS] Received ${Array.isArray(sessions) ? sessions.length : 0} sessions`)

    if (!Array.isArray(sessions)) {
      console.log('[SYNC-CONFIGURATOR-STATUS] Response format unexpected:', JSON.stringify(data).slice(0, 500))
      return new Response(JSON.stringify({
        success: false,
        message: 'No sessions array received',
        response: data
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let updatedCount = 0
    const results: any[] = []

    for (const session of sessions) {
      // Check if this session has been opened
      const hasOpened = session.link_opened || session.summary?.has_opened
      if (!hasOpened) {
        continue
      }

      // Find the lead by matching the token in the external link URL
      const token = session.token || session.session_id
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('id, company_name, configurator_opened')
        .ilike('external_configurator_link', `%${token}%`)
        .maybeSingle()

      if (leadError) {
        console.error('[SYNC-CONFIGURATOR-STATUS] Error finding lead:', leadError)
        continue
      }

      if (!lead) {
        console.log(`[SYNC-CONFIGURATOR-STATUS] No lead found for session ${session.id}`)
        continue
      }

      // Skip if already marked as opened
      if (lead.configurator_opened) {
        results.push({
          id: lead.id,
          company_name: lead.company_name,
          updated: false,
          reason: 'already_opened'
        })
        continue
      }

      // Update the lead
      const { error: updateError } = await supabase
        .from('leads')
        .update({
          configurator_opened: true,
          configurator_opened_at: session.last_opened_at || new Date().toISOString(),
          configurator_last_updated: new Date().toISOString(),
          configurator_model: session.summary?.has_selected_model ? session.selected_model : null
        })
        .eq('id', lead.id)

      if (!updateError) {
        updatedCount++
        results.push({
          id: lead.id,
          company_name: lead.company_name,
          updated: true
        })
        console.log(`[SYNC-CONFIGURATOR-STATUS] Updated lead ${lead.company_name}`)
      } else {
        console.error(`[SYNC-CONFIGURATOR-STATUS] Error updating lead:`, updateError)
      }
    }

    console.log(`[SYNC-CONFIGURATOR-STATUS] Completed. Updated ${updatedCount} leads.`)

    return new Response(JSON.stringify({
      success: true,
      total_sessions: sessions.length,
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
