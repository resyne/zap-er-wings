import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Lead {
  id: string;
  phone: string | null;
  contact_name: string | null;
  company_name: string | null;
  pipeline: string | null;
  created_at: string;
}

interface Campaign {
  id: string;
  name: string;
  target_pipeline: string | null;
  trigger_type: string;
  is_active: boolean;
  require_opt_in: boolean;
  activated_at: string | null;
}

interface CampaignStep {
  id: string;
  campaign_id: string;
  step_order: number;
  delay_days: number;
  delay_hours: number;
  delay_minutes: number;
  is_active: boolean;
  trigger_type?: string;
  trigger_from_step_id?: string;
  trigger_button_text?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Processing WhatsApp lead automations...')

    // IMPORTANT: Only process leads created in the last 24 HOURS
    // This ensures that scheduled_for (based on lead.created_at + delay) is always in the future
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, phone, contact_name, company_name, pipeline, created_at')
      .gte('created_at', oneDayAgo)
      .not('phone', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50)

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

    console.log(`Found ${leads.length} new leads (created in last 24h) to check for WhatsApp automations`)

    // Get active WhatsApp campaigns with trigger_type = 'lead_created'
    const { data: campaigns, error: campaignsError } = await supabase
      .from('whatsapp_automation_campaigns')
      .select('*')
      .eq('is_active', true)
      .in('trigger_type', ['lead_created', 'new_lead'])

    if (campaignsError) {
      console.error('Error fetching WhatsApp campaigns:', campaignsError)
      throw campaignsError
    }

    if (!campaigns || campaigns.length === 0) {
      console.log('No active WhatsApp campaigns found')
      return new Response(
        JSON.stringify({ success: true, message: 'No active WhatsApp campaigns', processed: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    console.log(`Found ${campaigns.length} active WhatsApp campaigns`)

    let totalExecutionsCreated = 0

    for (const lead of leads as Lead[]) {
      // Find matching campaigns for this lead
      for (const campaign of campaigns as Campaign[]) {
        // Check pipeline match (case-insensitive)
        // If campaign has no target_pipeline, it applies to all leads
        const pipelineMatches = !campaign.target_pipeline || 
          (lead.pipeline && lead.pipeline.toLowerCase() === campaign.target_pipeline.toLowerCase())

        if (!pipelineMatches) {
          console.log(`Lead ${lead.id} pipeline "${lead.pipeline}" doesn't match WhatsApp campaign "${campaign.name}" target "${campaign.target_pipeline}"`)
          continue
        }

        // Check campaign activation time - only enroll leads created after activation
        if (campaign.activated_at) {
          const leadCreated = new Date(lead.created_at)
          const campaignActivated = new Date(campaign.activated_at)
          if (leadCreated < campaignActivated) {
            console.log(`Lead ${lead.id} created before campaign "${campaign.name}" was activated`)
            continue
          }
        }

        // Check if executions already exist for this lead + campaign
        const { data: existingExecutions, error: execError } = await supabase
          .from('whatsapp_automation_executions')
          .select('id')
          .eq('lead_id', lead.id)
          .eq('campaign_id', campaign.id)
          .limit(1)

        if (execError) {
          console.error('Error checking existing WhatsApp executions:', execError)
          continue
        }

        if (existingExecutions && existingExecutions.length > 0) {
          console.log(`Lead ${lead.id} already has WhatsApp executions for campaign ${campaign.id}`)
          continue
        }

        // Get campaign steps
        const { data: steps, error: stepsError } = await supabase
          .from('whatsapp_automation_steps')
          .select('*')
          .eq('campaign_id', campaign.id)
          .eq('is_active', true)
          .order('step_order', { ascending: true })

        if (stepsError) {
          console.error('Error fetching WhatsApp campaign steps:', stepsError)
          continue
        }

        if (!steps || steps.length === 0) {
          console.log(`WhatsApp campaign ${campaign.name} has no active steps`)
          continue
        }

        console.log(`Creating ${steps.length} WhatsApp executions for lead ${lead.id} in campaign ${campaign.name}`)

        // Create executions ONLY for delay-based steps
        // Conditional steps (button_reply) will be created when the trigger condition is met
        const leadCreatedAt = new Date(lead.created_at)
        
        for (const step of steps as CampaignStep[]) {
          // Skip conditional steps - they are created dynamically when user replies
          const triggerType = (step as any).trigger_type
          if (triggerType && triggerType !== 'delay') {
            console.log(`Skipping conditional step ${step.id} (trigger_type: ${triggerType}) - will be created on trigger`)
            continue
          }
          
          // Calculate scheduled_for based on lead creation time + delay
          const scheduledFor = new Date(leadCreatedAt)
          scheduledFor.setDate(scheduledFor.getDate() + step.delay_days)
          scheduledFor.setHours(scheduledFor.getHours() + step.delay_hours)
          scheduledFor.setMinutes(scheduledFor.getMinutes() + step.delay_minutes)

          const { error: insertError } = await supabase
            .from('whatsapp_automation_executions')
            .insert({
              lead_id: lead.id,
              campaign_id: campaign.id,
              step_id: step.id,
              status: 'pending',
              scheduled_for: scheduledFor.toISOString()
            })

          if (insertError) {
            console.error('Error creating WhatsApp execution:', insertError)
            continue
          }

          totalExecutionsCreated++
        }
      }
    }

    console.log(`Created ${totalExecutionsCreated} new WhatsApp executions (excluding conditional steps)`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${leads.length} leads, created ${totalExecutionsCreated} WhatsApp executions`,
        leadsProcessed: leads.length,
        executionsCreated: totalExecutionsCreated
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in process-whatsapp-lead-automations:', errorMessage)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
})
