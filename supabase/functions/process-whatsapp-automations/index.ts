import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Country to language mapping
const COUNTRY_LANGUAGE_MAP: Record<string, string> = {
  'italy': 'it', 'italia': 'it', 'it': 'it',
  'spain': 'es', 'españa': 'es', 'spagna': 'es', 'es': 'es',
  'france': 'fr', 'francia': 'fr', 'fr': 'fr',
  'germany': 'de', 'germania': 'de', 'deutschland': 'de', 'de': 'de',
  'portugal': 'pt', 'portogallo': 'pt', 'brasil': 'pt_BR', 'brazil': 'pt_BR', 'pt': 'pt',
  'united kingdom': 'en', 'uk': 'en', 'usa': 'en', 'united states': 'en', 
  'canada': 'en', 'australia': 'en', 'en': 'en',
};

function getLanguageForCountry(country: string | null): string {
  if (!country) return 'en';
  const normalized = country.toLowerCase().trim();
  return COUNTRY_LANGUAGE_MAP[normalized] || 'en';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('Processing WhatsApp automations...');

    // Get pending executions that are scheduled for now or earlier
    const now = new Date().toISOString();
    const { data: executions, error: execError } = await supabase
      .from('whatsapp_automation_executions')
      .select(`
        *,
        campaign:whatsapp_automation_campaigns(*),
        step:whatsapp_automation_steps(*),
        lead:leads(id, contact_name, company_name, phone, country, pipeline, created_at, external_configurator_link, configurator_link)
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(50);
    
    // Filter out conditional executions that shouldn't be processed yet
    // These should only be processed when their trigger condition is met (via webhook)

    if (execError) {
      console.error('Error fetching executions:', execError);
      throw execError;
    }

    if (!executions || executions.length === 0) {
      console.log('No pending WhatsApp executions found');
      return new Response(
        JSON.stringify({ success: true, message: 'No pending executions', processed: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`Found ${executions.length} pending executions`);

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const execution of executions) {
      const { campaign, step, lead } = execution;

      // Validate required data
      if (!campaign || !step || !lead) {
        console.log(`Skipping execution ${execution.id}: missing campaign/step/lead data`);
        await supabase.from('whatsapp_automation_executions').update({
          status: 'failed',
          error_message: 'Missing campaign, step, or lead data'
        }).eq('id', execution.id);
        failed++;
        continue;
      }
      
      // Note: Conditional steps (trigger_type = 'button_reply') are now processed normally
      // The webhook creates the execution when the button is clicked, so if we have a pending execution
      // for a conditional step, it means the trigger already happened and we should process it.

      // Check if campaign is still active
      if (!campaign.is_active) {
        console.log(`Skipping execution ${execution.id}: campaign is inactive`);
        await supabase.from('whatsapp_automation_executions').update({
          status: 'cancelled',
          error_message: 'Campaign is inactive'
        }).eq('id', execution.id);
        skipped++;
        continue;
      }

      // Check pipeline match
      if (campaign.target_pipeline && lead.pipeline?.toLowerCase() !== campaign.target_pipeline.toLowerCase()) {
        console.log(`Skipping execution ${execution.id}: pipeline mismatch`);
        await supabase.from('whatsapp_automation_executions').update({
          status: 'cancelled',
          error_message: 'Pipeline mismatch'
        }).eq('id', execution.id);
        skipped++;
        continue;
      }

      // Check activated_at - only process leads created after campaign activation
      if (campaign.activated_at && new Date(lead.created_at) < new Date(campaign.activated_at)) {
        console.log(`Skipping execution ${execution.id}: lead created before campaign activation`);
        await supabase.from('whatsapp_automation_executions').update({
          status: 'cancelled',
          error_message: 'Lead created before campaign activation'
        }).eq('id', execution.id);
        skipped++;
        continue;
      }

      // Check phone number
      if (!lead.phone) {
        console.log(`Skipping execution ${execution.id}: no phone number`);
        await supabase.from('whatsapp_automation_executions').update({
          status: 'failed',
          error_message: 'Lead has no phone number'
        }).eq('id', execution.id);
        failed++;
        continue;
      }

      // Determine language for template
      let selectedLanguage = 'en';
      if (campaign.auto_select_language) {
        selectedLanguage = getLanguageForCountry(lead.country);
      }

      // Find the correct template based on name and language
      const templateName = step.template_name;
      if (!templateName) {
        console.log(`Skipping execution ${execution.id}: no template name`);
        await supabase.from('whatsapp_automation_executions').update({
          status: 'failed',
          error_message: 'No template name configured'
        }).eq('id', execution.id);
        failed++;
        continue;
      }

      // Get template matching name and language (fallback to en if not found)
      let { data: template } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('name', templateName)
        .eq('language', selectedLanguage)
        .eq('status', 'APPROVED')
        .single();

      if (!template) {
        // Fallback to English
        const { data: fallbackTemplate } = await supabase
          .from('whatsapp_templates')
          .select('*')
          .eq('name', templateName)
          .eq('language', 'en')
          .eq('status', 'APPROVED')
          .single();
        
        if (fallbackTemplate) {
          template = fallbackTemplate;
          selectedLanguage = 'en';
        }
      }

      if (!template) {
        // Try Italian as last resort
        const { data: itTemplate } = await supabase
          .from('whatsapp_templates')
          .select('*')
          .eq('name', templateName)
          .eq('language', 'it')
          .eq('status', 'APPROVED')
          .single();
        
        if (itTemplate) {
          template = itTemplate;
          selectedLanguage = 'it';
        }
      }

      if (!template) {
        console.log(`Skipping execution ${execution.id}: template "${templateName}" not found for language ${selectedLanguage}`);
        await supabase.from('whatsapp_automation_executions').update({
          status: 'failed',
          error_message: `Template not found: ${templateName}`
        }).eq('id', execution.id);
        failed++;
        continue;
      }

      // Get account to use
      const accountId = campaign.whatsapp_account_id;
      if (!accountId) {
        console.log(`Skipping execution ${execution.id}: no WhatsApp account configured`);
        await supabase.from('whatsapp_automation_executions').update({
          status: 'failed',
          error_message: 'No WhatsApp account configured for campaign'
        }).eq('id', execution.id);
        failed++;
        continue;
      }

      // Build template parameters (personalization)
      // Mapping: {{1}} Nome, {{2}} Azienda, {{3}} Data, {{4}} Link generico, {{5}} Link Configuratore
      const templateParams: string[] = [];
      const components = template.components as any[];
      if (components) {
        const bodyComponent = components.find((c: any) => c.type === 'BODY');
        if (bodyComponent && bodyComponent.text) {
          // Count parameters in template
          const paramMatches = bodyComponent.text.match(/\{\{\d+\}\}/g) || [];
          const configuratorLink = lead.external_configurator_link || lead.configurator_link || '';
          const today = new Date().toLocaleDateString('it-IT');
          
          for (let i = 0; i < paramMatches.length; i++) {
            // Map parameters according to standard: {{1}} Nome, {{2}} Azienda, {{3}} Data, {{4}} Link, {{5}} Configuratore
            if (i === 0) templateParams.push(lead.contact_name || lead.company_name || 'Cliente');
            else if (i === 1) templateParams.push(lead.company_name || '');
            else if (i === 2) templateParams.push(today);
            else if (i === 3) templateParams.push(''); // Generic link placeholder
            else if (i === 4) templateParams.push(configuratorLink); // {{5}} = Configurator link
            else templateParams.push('');
          }
        }
      }
      
      console.log(`Template params for ${lead.id}: ${JSON.stringify(templateParams)}, configurator_link: ${lead.external_configurator_link || lead.configurator_link || 'N/A'}`)

      console.log(`Sending WhatsApp to ${lead.phone} using template ${templateName} (${selectedLanguage})`);

      try {
        // Call whatsapp-send edge function
        const sendResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            account_id: accountId,
            to: lead.phone,
            type: 'template',
            template_name: templateName,
            template_language: selectedLanguage,
            template_params: templateParams,
            lead_id: lead.id, // Link conversation to lead
          }),
        });

        const sendResult = await sendResponse.json();

        if (sendResult.success) {
          console.log(`Successfully sent WhatsApp for execution ${execution.id}`);
          await supabase.from('whatsapp_automation_executions').update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            selected_language: selectedLanguage,
            template_used_id: template.id,
            wamid: sendResult.message_id || null,
          }).eq('id', execution.id);
          sent++;
        } else {
          console.error(`Failed to send WhatsApp for execution ${execution.id}:`, sendResult.error);
          await supabase.from('whatsapp_automation_executions').update({
            status: 'failed',
            error_message: sendResult.error || 'Unknown error',
            selected_language: selectedLanguage,
            template_used_id: template.id,
          }).eq('id', execution.id);
          failed++;
        }
      } catch (sendError: any) {
        console.error(`Error sending WhatsApp for execution ${execution.id}:`, sendError);
        await supabase.from('whatsapp_automation_executions').update({
          status: 'failed',
          error_message: sendError.message || 'Send error'
        }).eq('id', execution.id);
        failed++;
      }
    }

    console.log(`Processed ${executions.length} executions: ${sent} sent, ${failed} failed, ${skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${executions.length} executions`,
        sent,
        failed,
        skipped,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('Error in process-whatsapp-automations:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
