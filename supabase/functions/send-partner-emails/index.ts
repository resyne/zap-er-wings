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
  partner_type?: string;
  region?: string;
  subject: string;
  message: string;
  is_cronjob?: boolean;
}

interface Partner {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company_name: string;
  partner_type: string;
  region: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      partner_type, 
      region, 
      subject, 
      message, 
      is_cronjob = false 
    }: EmailRequest = await req.json();

    console.log('Email request received:', { partner_type, region, subject, is_cronjob });

    // Build query to fetch partners
    let query = supabase
      .from('partners')
      .select('id, first_name, last_name, email, company_name, partner_type, region')
      .not('email', 'is', null);

    // Apply filters
    if (partner_type) {
      query = query.eq('partner_type', partner_type);
    }
    if (region) {
      query = query.eq('region', region);
    }

    const { data: partners, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching partners:', fetchError);
      throw fetchError;
    }

    if (!partners || partners.length === 0) {
      console.log('No partners found with the specified criteria');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No partners found with the specified criteria',
          emails_sent: 0 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Found ${partners.length} partners to email`);

    // Send emails to all partners
    const emailPromises = partners.map(async (partner: Partner) => {
      const personalizedMessage = message.replace(
        /\{partner_name\}/g, 
        `${partner.first_name} ${partner.last_name}`
      ).replace(
        /\{company_name\}/g,
        partner.company_name
      );

      try {
        const emailResponse = await resend.emails.send({
          from: "Partnership Team <noreply@erp.abbattitorizapper.it>",
          to: [partner.email],
          subject: subject,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
                Comunicazione Partnership
              </h2>
              <div style="line-height: 1.6; color: #374151;">
                ${personalizedMessage.replace(/\n/g, '<br>')}
              </div>
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
                <p>Cordiali saluti,<br>Il Team Partnership</p>
                <p style="font-size: 12px; color: #9ca3af;">
                  Questa email è stata inviata automaticamente dal sistema di gestione partnership.
                </p>
              </div>
            </div>
          `,
        });

        console.log(`Email sent to ${partner.email}:`, emailResponse);
        return { partner_id: partner.id, success: true, response: emailResponse };
      } catch (emailError) {
        console.error(`Failed to send email to ${partner.email}:`, emailError);
        return { partner_id: partner.id, success: false, error: emailError.message };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`Email sending completed: ${successCount} successful, ${failureCount} failed`);

    // Log the email campaign if not from cronjob
    if (!is_cronjob) {
      try {
        await supabase.from('audit_logs').insert({
          table_name: 'email_campaigns',
          action: 'SEND',
          new_values: {
            partner_type,
            region,
            subject,
            recipients_count: partners.length,
            success_count: successCount,
            failure_count: failureCount,
            sent_at: new Date().toISOString()
          }
        });
      } catch (logError) {
        console.error('Failed to log email campaign:', logError);
      }
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
    console.error("Error in send-partner-emails function:", error);
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