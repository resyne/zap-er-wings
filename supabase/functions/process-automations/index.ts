import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing active automations...');

    // Get active automations
    const { data: automations, error: automationsError } = await supabase
      .from('email_automations')
      .select('*')
      .eq('is_active', true)
      .eq('trigger_type', 'after_campaign');

    if (automationsError) {
      console.error('Error fetching automations:', automationsError);
      throw automationsError;
    }

    if (!automations || automations.length === 0) {
      console.log('No active automations found');
      return new Response(
        JSON.stringify({ success: true, message: 'No active automations to process' }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Found ${automations.length} active automations`);

    let totalEmailsQueued = 0;

    for (const automation of automations) {
      console.log(`Processing automation: ${automation.name}`);

      // Get recent campaigns to check for new recipients
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - automation.delay_days - 1);

      const { data: recentCampaigns, error: campaignsError } = await supabase
        .from('email_campaigns')
        .select('id, created_at')
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false });

      if (campaignsError) {
        console.error(`Error fetching campaigns for automation ${automation.id}:`, campaignsError);
        continue;
      }

      if (!recentCampaigns || recentCampaigns.length === 0) {
        console.log(`No recent campaigns found for automation ${automation.name}`);
        continue;
      }

      // Get recipients based on target audience
      let recipients: any[] = [];

      if (automation.target_audience === 'custom_list' && automation.email_list_id) {
        const { data: contacts, error: contactsError } = await supabase
          .from('email_list_contacts')
          .select('email, first_name, last_name, company')
          .eq('email_list_id', automation.email_list_id);

        if (contactsError) {
          console.error(`Error fetching contacts for automation ${automation.id}:`, contactsError);
          continue;
        }

        recipients = contacts || [];
      } else if (automation.target_audience === 'crm_contacts') {
        const { data: contacts, error: contactsError } = await supabase
          .from('crm_contacts')
          .select('email, first_name, last_name, company_name');

        if (contactsError) {
          console.error(`Error fetching CRM contacts for automation ${automation.id}:`, contactsError);
          continue;
        }

        recipients = contacts?.filter(c => c.email) || [];
      } else if (automation.target_audience === 'partners') {
        const { data: partners, error: partnersError } = await supabase
          .from('partners')
          .select('email, company_name, contact_person');

        if (partnersError) {
          console.error(`Error fetching partners for automation ${automation.id}:`, partnersError);
          continue;
        }

        recipients = partners?.filter(p => p.email) || [];
      }

      if (recipients.length === 0) {
        console.log(`No recipients found for automation ${automation.name}`);
        continue;
      }

      // Get template if specified
      let template: any = null;
      if (automation.template_id) {
        const { data: templateData, error: templateError } = await supabase
          .from('newsletter_templates')
          .select('*')
          .eq('id', automation.template_id)
          .single();

        if (!templateError && templateData) {
          template = templateData;
        }
      }

      // Calculate scheduled time based on delay
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + automation.delay_days);

      // Check which emails have already been logged to avoid duplicates
      const { data: existingLogs, error: logsError } = await supabase
        .from('email_automation_logs')
        .select('recipient_email')
        .eq('automation_id', automation.id)
        .gte('created_at', cutoffDate.toISOString());

      const alreadySent = new Set(existingLogs?.map(log => log.recipient_email) || []);

      // Generate HTML content and queue emails
      const emailsToQueue = [];
      const logsToCreate = [];

      for (const recipient of recipients) {
        const recipientEmail = recipient.email;
        const recipientName = recipient.first_name 
          ? `${recipient.first_name} ${recipient.last_name || ''}`.trim()
          : recipient.contact_person || recipient.company_name || recipientEmail;

        // Skip if already queued
        if (alreadySent.has(recipientEmail)) {
          continue;
        }

        // Personalize message
        let personalizedMessage = automation.message
          .replace(/\[Nome\]/g, recipient.first_name || recipientName)
          .replace(/\[Cognome\]/g, recipient.last_name || '')
          .replace(/\[Azienda\]/g, recipient.company_name || recipient.company || '');

        // Generate HTML with template if available
        let htmlContent = personalizedMessage;
        if (template) {
          htmlContent = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { text-align: center; padding: 20px 0; }
                  .logo { max-width: 150px; }
                  .content { padding: 20px 0; }
                  .footer { text-align: center; padding: 20px 0; color: #666; font-size: 12px; }
                </style>
              </head>
              <body>
                <div class="container">
                  ${template.logo ? `<div class="header"><img src="${template.logo}" class="logo" alt="Logo"></div>` : ''}
                  ${template.header_text ? `<div class="header"><h2>${template.header_text}</h2></div>` : ''}
                  <div class="content">${personalizedMessage}</div>
                  ${template.signature ? `<div class="footer"><p>${template.signature}</p></div>` : ''}
                  ${template.footer_text ? `<div class="footer"><p>${template.footer_text}</p></div>` : ''}
                </div>
              </body>
            </html>
          `;
        } else {
          htmlContent = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                </style>
              </head>
              <body>
                <div class="container">${personalizedMessage}</div>
              </body>
            </html>
          `;
        }

        emailsToQueue.push({
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          subject: automation.subject,
          message: personalizedMessage,
          html_content: htmlContent,
          sender_email: automation.sender_email,
          sender_name: automation.sender_name,
          scheduled_at: scheduledDate.toISOString(),
          status: 'pending',
          metadata: {
            automation_id: automation.id,
            automation_name: automation.name
          }
        });

        logsToCreate.push({
          automation_id: automation.id,
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          scheduled_for: scheduledDate.toISOString(),
          status: 'scheduled'
        });
      }

      if (emailsToQueue.length > 0) {
        // Insert emails into queue
        const { error: queueError } = await supabase
          .from('email_queue')
          .insert(emailsToQueue);

        if (queueError) {
          console.error(`Error queuing emails for automation ${automation.id}:`, queueError);
          continue;
        }

        // Create automation logs
        const { error: logsInsertError } = await supabase
          .from('email_automation_logs')
          .insert(logsToCreate);

        if (logsInsertError) {
          console.error(`Error creating logs for automation ${automation.id}:`, logsInsertError);
        }

        console.log(`Queued ${emailsToQueue.length} emails for automation: ${automation.name}`);
        totalEmailsQueued += emailsToQueue.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${automations.length} automations, queued ${totalEmailsQueued} emails`,
        automationsProcessed: automations.length,
        emailsQueued: totalEmailsQueued
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in process-automations function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
