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
  country: string | null;
  external_configurator_link: string | null;
  configurator_link: string | null;
}

interface CampaignStep {
  id: string;
  campaign_id: string;
  subject: string;
  html_content: string;
}

interface StepTranslation {
  language_code: string;
  subject: string;
  html_content: string;
}

interface Campaign {
  id: string;
  name: string;
}

// Get language code from country name
async function getLanguageCode(supabase: any, country: string | null): Promise<string> {
  if (!country) return 'en' // Default to English
  
  const { data: mapping } = await supabase
    .from('country_language_mapping')
    .select('language_code')
    .eq('country_name', country)
    .single()
  
  return mapping?.language_code || 'en'
}

// Get translated step content or fallback to default
async function getStepContent(
  supabase: any, 
  stepId: string, 
  languageCode: string,
  defaultStep: CampaignStep
): Promise<{ subject: string; html_content: string }> {
  // If language is English, use default step content
  if (languageCode === 'en') {
    return { subject: defaultStep.subject, html_content: defaultStep.html_content }
  }
  
  // Try to fetch translation for the language
  const { data: translation, error } = await supabase
    .from('lead_automation_step_translations')
    .select('subject, html_content')
    .eq('step_id', stepId)
    .eq('language_code', languageCode)
    .single()
  
  if (error || !translation) {
    console.log(`No translation found for step ${stepId} in language ${languageCode}, using default (English)`)
    return { subject: defaultStep.subject, html_content: defaultStep.html_content }
  }
  
  console.log(`Using ${languageCode} translation for step ${stepId}`)
  return { subject: translation.subject, html_content: translation.html_content }
}

// Replace all placeholders in content
function replacePlaceholders(
  content: string, 
  lead: Lead, 
  configuratorLink: string
): string {
  return content
    .replace(/\{\{nome\}\}/gi, lead.contact_name?.split(' ')[0] || 'there')
    .replace(/\{\{cognome\}\}/gi, lead.contact_name?.split(' ').slice(1).join(' ') || '')
    .replace(/\{\{email\}\}/gi, lead.email)
    .replace(/\{\{telefono\}\}/gi, lead.phone || '')
    .replace(/\{\{azienda\}\}/gi, lead.company_name || '')
    .replace(/\{\{linkconfiguratore\}\}/gi, configuratorLink)
    .replace(/\{\{configurator_link\}\}/gi, configuratorLink)
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
        // Fetch full lead details including country
        const { data: lead, error: leadError } = await supabase
          .from('leads')
          .select('id, email, contact_name, company_name, phone, country, external_configurator_link, configurator_link')
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

        const typedLead = lead as Lead

        // Determine language based on lead's country
        const languageCode = await getLanguageCode(supabase, typedLead.country)
        console.log(`Lead ${typedLead.email} - Country: ${typedLead.country || 'unknown'} - Language: ${languageCode}`)

        // Fetch step details (default English content)
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

        // Get translated content based on language
        const stepContent = await getStepContent(supabase, execution.step_id, languageCode, step as CampaignStep)
        
        // Get configurator link
        const configuratorLink = typedLead.external_configurator_link || typedLead.configurator_link || ''
        console.log(`Lead ${typedLead.email} - Configurator link: ${configuratorLink}`)

        // Replace placeholders in content
        const htmlContent = replacePlaceholders(stepContent.html_content, typedLead, configuratorLink)
        const subject = replacePlaceholders(stepContent.subject, typedLead, configuratorLink)

        console.log(`Sending email to ${typedLead.email} for campaign "${campaign?.name || 'Unknown'}" in ${languageCode}`)

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

        // Update execution as sent with language info
        await supabase
          .from('lead_automation_executions')
          .update({ status: 'sent', sent_at: now })
          .eq('id', execution.id)

        console.log(`Email sent successfully to ${typedLead.email} in ${languageCode}, resend id: ${emailResponse?.id}`)
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
