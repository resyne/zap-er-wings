import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface QueueEmailRequest {
  active_only?: boolean;
  city?: string;
  country?: string;
  subject: string;
  message: string;
  logo?: string;
  headerText?: string;
  footerText?: string;
  signature?: string;
  sender_email?: string;
  sender_name?: string;
  use_crm_contacts?: boolean;
  use_partners?: boolean;
  partner_type?: string;
  acquisition_status?: string;
  region?: string;
  excluded_countries?: string[];
  custom_list_id?: string;
  custom_list_ids?: string[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      active_only = true,
      city, 
      country,
      subject,
      message,
      sender_email,
      sender_name,
      logo,
      headerText,
      footerText,
      signature,
      use_crm_contacts = false,
      use_partners = false,
      partner_type,
      acquisition_status,
      region,
      excluded_countries = [],
      custom_list_id,
      custom_list_ids
    }: QueueEmailRequest = await req.json();

    console.log('Queue email request received:', { 
      active_only, city, country, subject, use_crm_contacts, use_partners, 
      partner_type, acquisition_status, region, excluded_countries, custom_list_id, custom_list_ids,
      sender_email, sender_name, logo, headerText, footerText, signature
    });

    // Create sender email object
    const senderEmail = sender_email ? { email: sender_email, name: sender_name } : null;

    let recipients: Array<any> = [];

    // Handle custom email lists (multiple lists support)
    if (custom_list_ids && custom_list_ids.length > 0) {
      console.log('Fetching contacts from multiple custom lists:', custom_list_ids);
      const { data: listContacts, error: listError } = await supabase
        .from('email_list_contacts')
        .select('first_name, last_name, email, company')
        .in('email_list_id', custom_list_ids)
        .not('email', 'is', null);

      if (listError) {
        console.error('Error fetching list contacts:', listError);
        throw listError;
      }

      // Remove duplicates based on email
      const uniqueContactsMap = new Map();
      (listContacts || []).forEach(contact => {
        if (contact.email && !uniqueContactsMap.has(contact.email.toLowerCase())) {
          uniqueContactsMap.set(contact.email.toLowerCase(), {
            name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Cliente',
            email: contact.email,
            company_name: contact.company || ''
          });
        }
      });
      
      recipients = Array.from(uniqueContactsMap.values());
      console.log(`Found ${listContacts?.length || 0} total contacts, ${recipients.length} unique contacts`);
    }
    // Handle custom email list (single list - backward compatibility)
    else if (custom_list_id) {
      console.log('Fetching contacts from custom list:', custom_list_id);
      const { data: listContacts, error: listError } = await supabase
        .from('email_list_contacts')
        .select('first_name, last_name, email, company')
        .eq('email_list_id', custom_list_id)
        .not('email', 'is', null);

      if (listError) {
        console.error('Error fetching list contacts:', listError);
        throw listError;
      }

      recipients = (listContacts || []).map(contact => ({
        name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Cliente',
        email: contact.email,
        company_name: contact.company || ''
      }));
    }
    // Handle partners
    else if (use_partners) {
      console.log('Fetching partners with filters:', { partner_type, acquisition_status, region, excluded_countries });
      
      let query = supabase
        .from('partners')
        .select('id, first_name, last_name, email, company_name, partner_type, acquisition_status, region, country')
        .not('email', 'is', null);

      if (partner_type) {
        query = query.eq('partner_type', partner_type);
      }
      if (acquisition_status) {
        query = query.eq('acquisition_status', acquisition_status);
      }
      if (region) {
        query = query.ilike('region', `%${region}%`);
      }
      if (excluded_countries && excluded_countries.length > 0) {
        excluded_countries.forEach(country => {
          query = query.neq('country', country);
        });
      }

      const { data: partners, error: partnersError } = await query;

      if (partnersError) {
        console.error('Error fetching partners:', partnersError);
        throw partnersError;
      }

      recipients = (partners || []).map(partner => ({
        name: `${partner.first_name || ''} ${partner.last_name || ''}`.trim() || partner.company_name || 'Partner',
        email: partner.email,
        company_name: partner.company_name || ''
      }));
    }
    // Handle CRM contacts
    else if (use_crm_contacts) {
      console.log('Fetching CRM contacts');
      const { data: crmContacts, error: crmError } = await supabase
        .from('crm_contacts')
        .select('id, first_name, last_name, email, company_name')
        .not('email', 'is', null);

      if (crmError) {
        console.error('Error fetching CRM contacts:', crmError);
        throw crmError;
      }

      recipients = (crmContacts || []).map(contact => ({
        name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Cliente',
        email: contact.email,
        company_name: contact.company_name || ''
      }));
    }
    // Handle regular customers
    else {
      console.log('Fetching customers');
      let query = supabase
        .from('customers')
        .select('id, name, email, company_name, city, country')
        .not('email', 'is', null);

      if (active_only) {
        query = query.eq('active', true);
      }
      if (city) {
        query = query.eq('city', city);
      }
      if (country) {
        query = query.eq('country', country);
      }

      const { data: customers, error: fetchError } = await query;

      if (fetchError) {
        console.error('Error fetching customers:', fetchError);
        throw fetchError;
      }

      recipients = customers || [];
    }

    if (!recipients || recipients.length === 0) {
      console.log('No recipients found with the specified criteria');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No recipients found with the specified criteria',
          emailsQueued: 0 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Found ${recipients.length} recipients to queue`);

    // Generate campaign ID
    const campaignId = crypto.randomUUID();

    // Generate HTML content
    const generateEmailHtml = (recipient: any, personalizedMessage: string) => {
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          ${logo ? `
            <div style="text-align: center; padding: 20px; background-color: #f9fafb;">
              <img src="${logo}" alt="Logo" style="max-width: 200px; height: auto;" />
            </div>
          ` : ''}
          
          ${headerText ? `
            <div style="background-color: #1f2937; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">${headerText}</h1>
            </div>
          ` : ''}
          
          <div style="padding: 30px;">
            <h2 style="color: #1f2937; margin-top: 0; margin-bottom: 20px; font-size: 20px;">
              ${subject}
            </h2>
            
            <div style="line-height: 1.6; color: #374151; margin-bottom: 30px;">
              ${personalizedMessage.replace(/\n/g, '<br>')}
            </div>
            
            ${signature ? `
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280;">
                <div style="white-space: pre-line;">${signature}</div>
              </div>
            ` : ''}
          </div>
          
          ${footerText ? `
            <div style="padding: 20px; background-color: #f9fafb; color: #9ca3af; font-size: 12px; text-align: center; border-top: 1px solid #e5e7eb;">
              ${footerText}
            </div>
          ` : ''}
        </div>
      `;
    };

    // Queue emails for processing
    const emailsToQueue = recipients.map(recipient => {
      let personalizedMessage = message
        .replace(/\{partner_name\}/g, recipient.name)
        .replace(/\{customer_name\}/g, recipient.name)
        .replace(/\{company_name\}/g, recipient.company_name || '');

      // Clean up unwanted placeholders from message
      personalizedMessage = personalizedMessage
        .replace(/\[LOGO AZIENDALE\]\s*\n*/g, '')
        .replace(/🖼️ \[LOGO AZIENDALE\]\s*\n*/g, '')
        .replace(/━━━━━━━━━━━━━━━━━━━━━━━━\s*\n*/g, '')
        .replace(/ZAPPER - Pro \| Assistenza e Manutenzione Programmata per ristoranti\s*\n*/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      const htmlContent = generateEmailHtml(recipient, personalizedMessage);

      return {
        recipient_email: recipient.email,
        recipient_name: recipient.name,
        subject: subject,
        message: personalizedMessage,
        html_content: htmlContent,
        sender_email: senderEmail?.email || null,
        sender_name: senderEmail?.name || null,
        campaign_id: campaignId,
        metadata: {
           campaign_type: (custom_list_ids && custom_list_ids.length > 0) || custom_list_id ? 'custom_list' : (use_partners ? 'partners' : (use_crm_contacts ? 'crm_contacts' : 'customer')),
           active_only,
           city,
           country,
           custom_list_id,
           custom_list_ids,
           use_crm_contacts,
           use_partners,
           partner_type,
           acquisition_status,
           region,
           excluded_countries
         }
      };
    });

    // Insert into queue with batch processing
    const batchSize = 100;
    let totalQueued = 0;

    for (let i = 0; i < emailsToQueue.length; i += batchSize) {
      const batch = emailsToQueue.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('email_queue')
        .insert(batch);

      if (insertError) {
        console.error('Error queuing emails batch:', insertError);
        throw insertError;
      }

      totalQueued += batch.length;
      console.log(`Queued batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(emailsToQueue.length / batchSize)}: ${batch.length} emails`);
    }

    console.log(`Successfully queued ${totalQueued} emails for campaign ${campaignId}`);

    // Create campaign record
    try {
      const { error: campaignError } = await supabase
        .from('email_campaigns')
        .insert({
          id: campaignId,
          subject: subject,
          message: message,
          campaign_type: (custom_list_ids && custom_list_ids.length > 0) || custom_list_id ? 'Lista personalizzata' : (use_partners ? 'Partner' : (use_crm_contacts ? 'Contatti CRM' : 'Clienti')),
          recipients_count: totalQueued,
          success_count: 0,
          failure_count: 0,
          scheduled_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        });

      if (campaignError) {
        console.error('Error creating campaign record:', campaignError);
      } else {
        console.log('Campaign record created successfully');
      }
    } catch (campaignError) {
      console.error('Failed to create campaign record:', campaignError);
    }

    // Log the campaign
    try {
      await supabase.from('audit_logs').insert({
        table_name: 'email_campaigns',
        action: 'QUEUE',
         new_values: {
           campaign_id: campaignId,
           campaign_type: (custom_list_ids && custom_list_ids.length > 0) || custom_list_id ? 'custom_list' : (use_partners ? 'partners' : (use_crm_contacts ? 'crm_contacts' : 'customer')),
           active_only,
           city,
           country,
           custom_list_id,
           custom_list_ids,
           use_crm_contacts,
           use_partners,
           partner_type,
           acquisition_status,
           region,
           excluded_countries,
           subject,
           recipients_count: recipients.length,
           queued_at: new Date().toISOString()
         }
      });
    } catch (logError) {
      console.error('Failed to log email campaign:', logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully queued ${totalQueued} emails for processing`,
        emailsQueued: totalQueued,
        campaignId: campaignId
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in queue-newsletter-emails function:", error);
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