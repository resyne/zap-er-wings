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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing email queue...');

    // Get pending emails (process 10 at a time to avoid rate limits)
    const { data: pendingEmails, error: fetchError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .filter('attempts', 'lt', 'max_attempts')
      .order('created_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error('Error fetching pending emails:', fetchError);
      throw fetchError;
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      console.log('No pending emails to process');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No pending emails to process',
          processed: 0
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Processing ${pendingEmails.length} emails`);

    let successCount = 0;
    let failureCount = 0;

    // Process each email
    for (const email of pendingEmails) {
      try {
        console.log(`Sending email to ${email.recipient_email}...`);

        // Update status to sending
        await supabase
          .from('email_queue')
          .update({ 
            status: 'sending',
            attempts: email.attempts + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id);

        // Determine sender
        const fromEmail = email.sender_email ? 
          `${email.sender_name || 'Customer Service'} <${email.sender_email}>` : 
          "Customer Service <noreply@erp.abbattitorizapper.it>";

        // Send email via Resend
        const emailResponse = await resend.emails.send({
          from: fromEmail,
          to: [email.recipient_email],
          subject: email.subject,
          html: email.html_content,
        });

        if (emailResponse.error) {
          throw new Error(emailResponse.error.message);
        }

        // Update status to sent
        await supabase
          .from('email_queue')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            error_message: null
          })
          .eq('id', email.id);

        console.log(`Email sent successfully to ${email.recipient_email}:`, emailResponse);
        successCount++;

      } catch (emailError: any) {
        console.error(`Failed to send email to ${email.recipient_email}:`, emailError);
        
        // Determine if we should retry or mark as failed
        const newStatus = email.attempts + 1 >= email.max_attempts ? 'failed' : 'retrying';
        
        await supabase
          .from('email_queue')
          .update({ 
            status: newStatus,
            error_message: emailError.message,
            updated_at: new Date().toISOString(),
            // Schedule retry in 5 minutes if not max attempts reached
            scheduled_at: newStatus === 'retrying' ? 
              new Date(Date.now() + 5 * 60 * 1000).toISOString() : 
              email.scheduled_at
          })
          .eq('id', email.id);

        failureCount++;
      }

      // Add delay between emails to respect rate limits (1 second)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`Email processing completed: ${successCount} sent, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${pendingEmails.length} emails: ${successCount} sent, ${failureCount} failed`,
        processed: pendingEmails.length,
        sent: successCount,
        failed: failureCount
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in process-email-queue function:", error);
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