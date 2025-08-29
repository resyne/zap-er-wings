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
}

interface Customer {
  id: string;
  name: string;
  email: string;
  company_name?: string;
  city?: string;
  country?: string;
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
      message
    }: EmailRequest = await req.json();

    console.log('Email request received:', { active_only, city, country, subject });

    // Build query to fetch customers
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

    if (!customers || customers.length === 0) {
      console.log('No customers found with the specified criteria');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No customers found with the specified criteria',
          emails_sent: 0 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Found ${customers.length} customers to email`);

    // Send emails to all customers
    const emailPromises = customers.map(async (customer: Customer) => {
      const personalizedMessage = message.replace(
        /\{customer_name\}/g, 
        customer.name
      ).replace(
        /\{company_name\}/g,
        customer.company_name || ''
      );

      try {
        const emailResponse = await resend.emails.send({
          from: "Customer Service <noreply@erp.abbattitorizapper.it>",
          to: [customer.email],
          subject: subject,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
                Comunicazione Clienti
              </h2>
              <div style="line-height: 1.6; color: #374151;">
                ${personalizedMessage.replace(/\n/g, '<br>')}
              </div>
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
                <p>Cordiali saluti,<br>Il Team Customer Service</p>
                <p style="font-size: 12px; color: #9ca3af;">
                  Questa email è stata inviata automaticamente dal sistema di gestione clienti.
                </p>
              </div>
              <div style="margin-top: 20px; padding: 20px; background-color: #f9fafb; border-radius: 8px; text-align: center;">
                <img src="https://927bac44-432a-46fc-b33f-adc680e49394.sandbox.lovable.dev/lovable-uploads/e8493046-02d3-407a-ae34-b061ef9720af.png" alt="ZAPPER Logo" style="height: 48px; margin-bottom: 12px;">
                <div style="font-size: 12px; color: #6b7280; line-height: 1.5;">
                  <div style="font-weight: 500;">info@abbattitorizapper.it | Scafati (SA) - Italy | 08119968436</div>
                  <div style="color: #2563eb; margin-top: 4px;">
                    <a href="https://www.abbattitorizapper.it" target="_blank" style="color: #2563eb; text-decoration: none;">
                      www.abbattitorizapper.it
                    </a>
                  </div>
                </div>
              </div>
            </div>
          `,
        });

        console.log(`Email sent to ${customer.email}:`, emailResponse);
        return { customer_id: customer.id, success: true, response: emailResponse };
      } catch (emailError) {
        console.error(`Failed to send email to ${customer.email}:`, emailError);
        return { customer_id: customer.id, success: false, error: emailError.message };
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
          campaign_type: 'customer',
          active_only,
          city,
          country,
          subject,
          recipients_count: customers.length,
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
        emails_sent: successCount,
        emails_failed: failureCount,
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