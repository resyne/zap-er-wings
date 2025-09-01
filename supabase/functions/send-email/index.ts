import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  from: string;
  to: string;
  subject: string;
  body: string;
  smtp_config: {
    server: string;
    port: number;
    email: string;
    password: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Send email function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const { from, to, subject, body, smtp_config }: SendEmailRequest = await req.json();

    console.log("Sending email from:", from, "to:", to);

    // Use Resend to send the email
    const emailResponse = await resend.emails.send({
      from: `Zapper ERP <onboarding@resend.dev>`, // Use a verified sender
      to: [to],
      subject: subject,
      replyTo: from, // Set the original sender as reply-to
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">Zapper ERP</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Sistema Email Aziendale</p>
          </div>
          <div style="padding: 20px; background: #f9f9f9;">
            <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">
                <strong>Da:</strong> ${from}
              </p>
              <div style="border-left: 4px solid #667eea; padding-left: 15px; margin: 20px 0;">
                ${body.replace(/\n/g, '<br>')}
              </div>
            </div>
          </div>
          <div style="background: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">Questa email è stata inviata tramite Zapper ERP</p>
          </div>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email inviata con successo",
        id: emailResponse.data?.id 
      }), 
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in send-email function:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Errore durante l'invio dell'email", 
        details: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);