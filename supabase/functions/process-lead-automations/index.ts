import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Lead {
  id: string;
  email: string;
  contact_name: string | null;
  company_name: string | null;
  phone: string | null;
  pipeline: string | null;
  created_at: string;
}

interface Campaign {
  id: string;
  name: string;
  target_pipeline: string | null;
  is_active: boolean;
}

interface CampaignStep {
  id: string;
  campaign_id: string;
  step_order: number;
  delay_days: number;
  delay_hours: number;
  delay_minutes: number;
  is_active: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Processing lead automations...')

    // IMPORTANT: Only process leads created in the last 24 HOURS
    // This ensures that scheduled_at (based on lead.created_at + delay) is always in the future
    // For older leads, use the manual enroll-leads-in-campaign function which uses NOW() as the base time
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, email, contact_name, company_name, phone, pipeline, created_at')
      .gte('created_at', oneDayAgo)
      .not('email', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50) // Smaller batch for recent leads only

    if (leadsError) {
      console.error('Error fetching leads:', leadsError)
      throw leadsError
    }

    if (!leads || leads.length === 0) {
      console.log('No new leads found in the last 24 hours')
      return new Response(
        JSON.stringify({ success: true, message: 'No new leads to process', processed: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    console.log(`Found ${leads.length} new leads (created in last 24h) to check`)

    // Get active campaigns with trigger_type = 'new_lead'
    const { data: campaigns, error: campaignsError } = await supabase
      .from('lead_automation_campaigns')
      .select('*')
      .eq('is_active', true)
      .eq('trigger_type', 'new_lead')

    if (campaignsError) {
      console.error('Error fetching campaigns:', campaignsError)
      throw campaignsError
    }

    if (!campaigns || campaigns.length === 0) {
      console.log('No active campaigns found')
      return new Response(
        JSON.stringify({ success: true, message: 'No active campaigns', processed: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    console.log(`Found ${campaigns.length} active campaigns`)

    let totalExecutionsCreated = 0

    for (const lead of leads as Lead[]) {
      // Find matching campaigns for this lead
      for (const campaign of campaigns as Campaign[]) {
        // Check pipeline match
        // If campaign has no target_pipeline, it applies to all leads
        // If campaign has target_pipeline, lead must match (case-insensitive)
        const pipelineMatches = !campaign.target_pipeline || 
          (lead.pipeline && lead.pipeline.toLowerCase() === campaign.target_pipeline.toLowerCase())

        if (!pipelineMatches) {
          console.log(`Lead ${lead.id} pipeline "${lead.pipeline}" doesn't match campaign "${campaign.name}" target "${campaign.target_pipeline}"`)
          continue
        }

        // Check if executions already exist for this lead + campaign
        const { data: existingExecutions, error: execError } = await supabase
          .from('lead_automation_executions')
          .select('id')
          .eq('lead_id', lead.id)
          .eq('campaign_id', campaign.id)
          .limit(1)

        if (execError) {
          console.error('Error checking existing executions:', execError)
          continue
        }

        if (existingExecutions && existingExecutions.length > 0) {
          console.log(`Lead ${lead.id} already has executions for campaign ${campaign.id}`)
          continue
        }

        // Get campaign steps
        const { data: steps, error: stepsError } = await supabase
          .from('lead_automation_steps')
          .select('*')
          .eq('campaign_id', campaign.id)
          .eq('is_active', true)
          .order('step_order', { ascending: true })

        if (stepsError) {
          console.error('Error fetching campaign steps:', stepsError)
          continue
        }

        if (!steps || steps.length === 0) {
          console.log(`Campaign ${campaign.name} has no active steps`)
          continue
        }

        console.log(`Creating ${steps.length} executions for lead ${lead.id} in campaign ${campaign.name}`)

        // Create executions for each step
        const leadCreatedAt = new Date(lead.created_at)
        
        for (const step of steps as CampaignStep[]) {
          // Calculate scheduled_at based on lead creation time + delay
          const scheduledAt = new Date(leadCreatedAt)
          scheduledAt.setDate(scheduledAt.getDate() + step.delay_days)
          scheduledAt.setHours(scheduledAt.getHours() + step.delay_hours)
          scheduledAt.setMinutes(scheduledAt.getMinutes() + step.delay_minutes)

          const { error: insertError } = await supabase
            .from('lead_automation_executions')
            .insert({
              lead_id: lead.id,
              campaign_id: campaign.id,
              step_id: step.id,
              status: 'pending',
              scheduled_at: scheduledAt.toISOString()
            })

          if (insertError) {
            console.error('Error creating execution:', insertError)
            continue
          }

          totalExecutionsCreated++
        }
      }
    }

    console.log(`Created ${totalExecutionsCreated} new executions`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${leads.length} leads, created ${totalExecutionsCreated} executions`,
        leadsProcessed: leads.length,
        executionsCreated: totalExecutionsCreated
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in process-lead-automations:', errorMessage)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
})
