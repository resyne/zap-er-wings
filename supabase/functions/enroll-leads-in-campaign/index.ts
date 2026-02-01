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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { leadIds, campaignId } = await req.json()

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'leadIds array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    if (!campaignId) {
      return new Response(
        JSON.stringify({ success: false, error: 'campaignId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    console.log(`Enrolling ${leadIds.length} leads in campaign ${campaignId}`)

    // Get campaign steps
    const { data: steps, error: stepsError } = await supabase
      .from('lead_automation_steps')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('is_active', true)
      .order('step_order', { ascending: true })

    if (stepsError) {
      console.error('Error fetching steps:', stepsError)
      throw stepsError
    }

    if (!steps || steps.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No active steps found for campaign' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    console.log(`Found ${steps.length} steps for campaign`)

    let totalExecutionsCreated = 0
    const now = new Date()

    for (const leadId of leadIds) {
      // Check if lead already has executions for this campaign
      const { data: existingExecutions, error: execError } = await supabase
        .from('lead_automation_executions')
        .select('id')
        .eq('lead_id', leadId)
        .eq('campaign_id', campaignId)
        .limit(1)

      if (execError) {
        console.error(`Error checking executions for lead ${leadId}:`, execError)
        continue
      }

      if (existingExecutions && existingExecutions.length > 0) {
        console.log(`Lead ${leadId} already has executions for this campaign, skipping`)
        continue
      }

      // Get lead info
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('id, email, contact_name, country')
        .eq('id', leadId)
        .single()

      if (leadError || !lead) {
        console.error(`Lead ${leadId} not found:`, leadError)
        continue
      }

      console.log(`Creating executions for lead ${lead.email} (${lead.country})`)

      // Create executions for each step
      for (const step of steps) {
        // Calculate scheduled_at based on NOW + delay
        const scheduledAt = new Date(now)
        scheduledAt.setDate(scheduledAt.getDate() + (step.delay_days || 0))
        scheduledAt.setHours(scheduledAt.getHours() + (step.delay_hours || 0))
        scheduledAt.setMinutes(scheduledAt.getMinutes() + (step.delay_minutes || 0))

        const { error: insertError } = await supabase
          .from('lead_automation_executions')
          .insert({
            lead_id: leadId,
            campaign_id: campaignId,
            step_id: step.id,
            status: 'pending',
            scheduled_at: scheduledAt.toISOString()
          })

        if (insertError) {
          console.error(`Error creating execution for step ${step.step_order}:`, insertError)
          continue
        }

        console.log(`Created execution for step ${step.step_order} scheduled at ${scheduledAt.toISOString()}`)
        totalExecutionsCreated++
      }
    }

    console.log(`Created ${totalExecutionsCreated} total executions`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Created ${totalExecutionsCreated} executions for ${leadIds.length} leads`,
        executionsCreated: totalExecutionsCreated
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in enroll-leads-in-campaign:', errorMessage)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
})
