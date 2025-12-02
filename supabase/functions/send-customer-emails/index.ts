import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface EmailRequest {
  active_only?: boolean;
  city?: string;
  country?: string;
  subject: string;
  message: string;
  is_newsletter?: boolean;
  template?: any;
  senderEmail?: any;
  use_crm_contacts?: boolean;
  custom_list_id?: string;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  company_name?: string;
  city?: string;
  country?: string;
}

interface Contact {
  id: string;
  first_name?: string;
  last_name?: string;
  email: string;
  company_name?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
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
      is_newsletter = false,
      template,
      senderEmail,
      use_crm_contacts = false,
      custom_list_id
    }: EmailRequest = await req.json();

    console.log('Email request received:', { active_only, city, country, subject, use_crm_contacts, custom_list_id });

    let recipients: Array<Customer | Contact> = [];

    // Handle custom email list
    if (custom_list_id) {
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
        id: contact.email, // Use email as ID for list contacts
        name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Cliente',
        email: contact.email,
        company_name: contact.company || ''
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
        id: contact.id,
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

      // Apply filters
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
          emailsSent: 0 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Found ${recipients.length} recipients to email`);

    // Determine sender information
    const fromEmail = senderEmail?.email ? 
      `${senderEmail.name} <${senderEmail.email}>` : 
      "Customer Service <noreply@erp.abbattitorizapper.it>";

    // Send emails to all recipients
    const emailPromises = recipients.map(async (recipient: Customer | Contact) => {
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

      // Generate email content based on whether it's a newsletter with template
      let emailHtml = '';
      if (is_newsletter && template) {
        emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${template.logo ? `<div style="text-align: center; margin-bottom: 30px;"><img src="${template.logo}" alt="Logo" style="max-height: 80px;"></div>` : ''}
            
            <h2 style="color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
              ${template.headerText || 'Newsletter'}
            </h2>
            
            <div style="line-height: 1.6; color: #374151; margin: 30px 0;">
              ${personalizedMessage.replace(/\n/g, '<br>')}
            </div>
            
            ${template.attachments && template.attachments.length > 0 ? `
              <div style="margin: 30px 0; padding: 20px; background-color: #f3f4f6; border-radius: 8px;">
                <h4 style="margin-top: 0; color: #374151;">📎 Allegati:</h4>
                ${template.attachments.map((att: any) => `
                  <div style="margin: 8px 0;">
                    <a href="${att.url}" style="color: #2563eb; text-decoration: none;">${att.name}</a>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280;">
              <div style="white-space: pre-line;">${template.signature || 'Cordiali saluti,\nIl Team'}</div>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; text-align: center;">
              ${template.footerText || '© 2024. Tutti i diritti riservati.'}
            </div>
          </div>
        `;
      } else {
        // Professional HTML template with company logo
        emailHtml = `
          <!DOCTYPE html>
          <html lang="it">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${subject}</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: 'Arial', 'Helvetica', sans-serif; background-color: #f4f4f4;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 40px 20px;">
                  <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <!-- Header with Logo -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #D84315 0%, #FF6F00 100%); padding: 30px; text-align: center;">
                        <img src="https://rucjkoleodtwrbftwgsm.supabase.co/storage/v1/object/public/brand-assets/logo-vesuviano.png" 
                             alt="Vesuviano Logo" 
                             style="max-width: 200px; height: auto; margin-bottom: 15px;">
                        <h2 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600; text-shadow: 0 1px 3px rgba(0,0,0,0.2);">
                          Vesuviano Forni
                        </h2>
                        <p style="color: #ffffff; margin: 5px 0 0 0; font-size: 14px; opacity: 0.95;">
                          L'autenticità del gusto italiano
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px 30px;">
                        <div style="color: #333333; font-size: 15px; line-height: 1.6;">
                          ${personalizedMessage.replace(/\n/g, '<br>')}
                        </div>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #f8f8f8; padding: 30px; border-top: 3px solid #D84315;">
                        <div style="text-align: center; margin-bottom: 20px;">
                          <p style="margin: 0 0 10px 0; color: #555555; font-size: 14px; font-weight: 600;">
                            Cordiali saluti,<br>
                            Il Team Vesuviano Forni
                          </p>
                        </div>
                        
                        <table role="presentation" style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                          <tr>
                            <td style="text-align: center; padding: 15px 0; border-top: 1px solid #e0e0e0;">
                              <p style="margin: 0; font-size: 12px; color: #888888; line-height: 1.5;">
                                <strong>Vesuviano Forni</strong><br>
                                Via Piaia 44, 67034 Pettorano sul Gizio (AQ), Italia<br>
                                📧 <a href="mailto:info@vesuvianoforni.it" style="color: #D84315; text-decoration: none;">info@vesuvianoforni.it</a> | 
                                📞 +39 081 19968436<br>
                                🌐 <a href="https://www.vesuvianoforni.it" style="color: #D84315; text-decoration: none;">www.vesuvianoforni.it</a>
                              </p>
                            </td>
                          </tr>
                        </table>
                        
                        <div style="text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
                          <p style="margin: 0; font-size: 11px; color: #999999;">
                            Questa email è stata inviata dal sistema CRM Vesuviano Forni.
                          </p>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `;
      }

      try {
        const emailResponse = await resend.emails.send({
          from: fromEmail,
          to: [recipient.email],
          subject: subject,
          html: emailHtml,
        });

        console.log(`Email sent to ${recipient.email}:`, emailResponse);
        return { recipient_id: recipient.id, success: true, response: emailResponse };
      } catch (emailError) {
        console.error(`Failed to send email to ${recipient.email}:`, emailError);
        return { recipient_id: recipient.id, success: false, error: emailError.message };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`Email sending completed: ${successCount} successful, ${failureCount} failed`);

    // Log the email campaign
    try {
      await supabase.from('audit_logs').insert({
        table_name: 'email_campaigns',
        action: 'SEND',
        new_values: {
          campaign_type: custom_list_id ? 'custom_list' : (use_crm_contacts ? 'crm_contacts' : 'customer'),
          active_only,
          city,
          country,
          custom_list_id,
          use_crm_contacts,
          subject,
          recipients_count: recipients.length,
          success_count: successCount,
          failure_count: failureCount,
          sent_at: new Date().toISOString()
        }
      });
    } catch (logError) {
      console.error('Failed to log email campaign:', logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email campaign completed: ${successCount} emails sent successfully, ${failureCount} failed`,
        emailsSent: successCount,
        emailsFailed: failureCount,
        results: results
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in send-customer-emails function:", error);
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