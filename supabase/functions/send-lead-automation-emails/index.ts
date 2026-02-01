import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'
import { Resend } from 'npm:resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LeadAutomationExecution {
  id: string;
  lead_id: string;
  campaign_id: string;
  step_id: string;
  status: string;
  scheduled_at: string;
}

interface Lead {
  id: string;
  email: string;
  contact_name: string | null;
  company_name: string | null;
  phone: string | null;
}

interface CampaignStep {
  id: string;
  campaign_id: string;
  subject: string;
  html_content: string;
}

interface Campaign {
  id: string;
  name: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured')
      return new Response(
        JSON.stringify({ success: false, error: 'RESEND_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const resend = new Resend(resendApiKey)

    console.log('Sending scheduled lead automation emails...')

    // Get pending executions that are due
    const now = new Date().toISOString()
    
    const { data: executions, error: execError } = await supabase
      .from('lead_automation_executions')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })
      .limit(50)

    if (execError) {
      console.error('Error fetching executions:', execError)
      throw execError
    }

    if (!executions || executions.length === 0) {
      console.log('No pending emails to send')
      return new Response(
        JSON.stringify({ success: true, message: 'No pending emails', sent: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    console.log(`Found ${executions.length} pending emails to send`)

    let sentCount = 0
    let errorCount = 0

    for (const execution of executions as LeadAutomationExecution[]) {
      try {
        // Fetch lead details
        const { data: lead, error: leadError } = await supabase
          .from('leads')
          .select('id, email, contact_name, company_name, phone')
          .eq('id', execution.lead_id)
          .single()

        if (leadError || !lead) {
          console.error(`Lead ${execution.lead_id} not found:`, leadError)
          await supabase
            .from('lead_automation_executions')
            .update({ status: 'failed', sent_at: now, error_message: 'Lead not found' })
            .eq('id', execution.id)
          errorCount++
          continue
        }

        if (!lead.email) {
          console.error(`Lead ${execution.lead_id} has no email`)
          await supabase
            .from('lead_automation_executions')
            .update({ status: 'failed', sent_at: now, error_message: 'No email address' })
            .eq('id', execution.id)
          errorCount++
          continue
        }

        // Fetch step details
        const { data: step, error: stepError } = await supabase
          .from('lead_automation_steps')
          .select('id, campaign_id, subject, html_content')
          .eq('id', execution.step_id)
          .single()

        if (stepError || !step) {
          console.error(`Step ${execution.step_id} not found:`, stepError)
          await supabase
            .from('lead_automation_executions')
            .update({ status: 'failed', sent_at: now, error_message: 'Step not found' })
            .eq('id', execution.id)
          errorCount++
          continue
        }

        // Fetch campaign for logging
        const { data: campaign } = await supabase
          .from('lead_automation_campaigns')
          .select('id, name')
          .eq('id', execution.campaign_id)
          .single()

        // Replace placeholders in HTML content
        const typedLead = lead as Lead
        let htmlContent = step.html_content
          .replace(/\{\{nome\}\}/gi, typedLead.contact_name?.split(' ')[0] || 'there')
          .replace(/\{\{cognome\}\}/gi, typedLead.contact_name?.split(' ').slice(1).join(' ') || '')
          .replace(/\{\{email\}\}/gi, typedLead.email)
          .replace(/\{\{telefono\}\}/gi, typedLead.phone || '')
          .replace(/\{\{azienda\}\}/gi, typedLead.company_name || '')

        let subject = step.subject
          .replace(/\{\{nome\}\}/gi, typedLead.contact_name?.split(' ')[0] || 'there')
          .replace(/\{\{azienda\}\}/gi, typedLead.company_name || '')

        console.log(`Sending email to ${typedLead.email} for campaign "${campaign?.name || 'Unknown'}"`)

        // Send email via Resend
        const { data: emailResponse, error: emailError } = await resend.emails.send({
          from: 'Vesuviano Forni <noreply@abbattitorizapper.it>',
          to: [typedLead.email],
          subject: subject,
          html: htmlContent,
        })

        if (emailError) {
          console.error(`Failed to send email to ${typedLead.email}:`, emailError)
          await supabase
            .from('lead_automation_executions')
            .update({ 
              status: 'failed', 
              sent_at: now, 
              error_message: emailError.message || 'Email send failed' 
            })
            .eq('id', execution.id)
          errorCount++
          continue
        }

        // Update execution as sent
        await supabase
          .from('lead_automation_executions')
          .update({ status: 'sent', sent_at: now })
          .eq('id', execution.id)

        console.log(`Email sent successfully to ${typedLead.email}, resend id: ${emailResponse?.id}`)
        sentCount++

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        console.error(`Error processing execution ${execution.id}:`, errorMessage)
        await supabase
          .from('lead_automation_executions')
          .update({ status: 'failed', sent_at: now, error_message: errorMessage })
          .eq('id', execution.id)
        errorCount++
      }
    }

    console.log(`Finished: ${sentCount} sent, ${errorCount} failed`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${sentCount} emails, ${errorCount} failed`,
        sent: sentCount,
        failed: errorCount
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in send-lead-automation-emails:', errorMessage)
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
})
