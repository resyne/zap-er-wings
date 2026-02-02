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
    const payload = await req.json()
    console.log('[CONFIGURATOR-WEBHOOK] Full request received')
    console.log('[CONFIGURATOR-WEBHOOK] Payload:', JSON.stringify(payload, null, 2))
    console.log('[CONFIGURATOR-WEBHOOK] Event type:', payload.event_type)
    console.log('[CONFIGURATOR-WEBHOOK] Session ID:', payload.session_id)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Find lead using session_id or email
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('configurator_session_id', payload.session_id)
      .maybeSingle()

    if (!lead) {
      console.log('[CONFIGURATOR-WEBHOOK] Lead not found for session:', payload.session_id)
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Update lead with new data
    const updates: any = {
      configurator_last_updated: new Date().toISOString(),
    }

    // Check for direct link_opened field (from external Vesuviano site)
    if (payload.link_opened === true) {
      updates.configurator_opened = true
      updates.configurator_opened_at = payload.last_opened_at || payload.timestamp || new Date().toISOString()
      console.log('[CONFIGURATOR-WEBHOOK] Direct link_opened detected, setting configurator_opened=true')
    }

    // Track specific events (legacy event_type format)
    switch (payload.event_type) {
      case 'link_opened':
        updates.configurator_opened = true
        updates.configurator_opened_at = payload.timestamp
        break
      
      case 'model_selected':
        updates.configurator_model = payload.event_data?.model_name
        break
      
      case 'quote_saved':
        updates.configurator_quote_price = payload.event_data?.totalPrice
        updates.configurator_has_quote = true
        break
      
      case 'contact_requested':
        updates.configurator_status = 'interested'
        updates.lead_status = 'hot'
        break
      
      case 'payment_completed':
        updates.configurator_status = 'paid'
        updates.lead_status = 'won'
        updates.deal_amount = payload.quote?.total_price
        break
      
      case 'feedback_not_interested':
        updates.configurator_status = 'not_interested'
        updates.lead_status = 'lost'
        updates.lost_reason = payload.feedback_reason
        break
    }

    // Add event to history with description
    const currentHistory = lead.configurator_history || []
    currentHistory.push({
      event_type: payload.event_type,
      description: payload.description || payload.event_type,
      timestamp: payload.timestamp,
      data: payload.event_data
    })
    updates.configurator_history = currentHistory

    // Save updates
    const { error: updateError } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', lead.id)

    if (updateError) {
      console.error('[CONFIGURATOR-WEBHOOK] Error updating lead:', updateError)
      throw updateError
    }

    console.log('[CONFIGURATOR-WEBHOOK] Lead updated successfully:', lead.id)

    return new Response(JSON.stringify({ received: true, updated: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('[CONFIGURATOR-WEBHOOK] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
