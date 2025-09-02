import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendOfferEmailRequest {
  to: string;
  customerName: string;
  offerNumber: string;
  offerTitle: string;
  amount: number;
  validUntil?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
  selectedDocs?: string[];
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      to,
      customerName,
      offerNumber,
      offerTitle,
      amount,
      validUntil,
      attachments = [],
      selectedDocs = []
    }: SendOfferEmailRequest = await req.json();

    console.log('Sending offer email to:', to);

    // Prepare email content
    const validUntilText = validUntil 
      ? `Validità dell'offerta: ${new Date(validUntil).toLocaleDateString('it-IT')}`
      : '';

    const attachmentsList = selectedDocs.length > 0 
      ? `<p>Documenti tecnici allegati:</p><ul>${selectedDocs.map(doc => `<li>Documento tecnico</li>`).join('')}</ul>`
      : '';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 30px;">
          <h1 style="color: #1f2937; margin: 0;">ZAPPER S.R.L.</h1>
          <p style="color: #6b7280; margin: 5px 0;">Soluzioni professionali per la ristorazione</p>
        </div>
        
        <h2 style="color: #1f2937;">Gentile ${customerName},</h2>
        
        <p style="color: #374151; line-height: 1.6;">
          Siamo lieti di inviarle la nostra offerta commerciale come richiesto.
        </p>
        
        <div style="background-color: #f9fafb; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0;">
          <h3 style="color: #1f2937; margin-top: 0;">Dettagli Offerta</h3>
          <p style="margin: 5px 0;"><strong>Numero Offerta:</strong> ${offerNumber}</p>
          <p style="margin: 5px 0;"><strong>Oggetto:</strong> ${offerTitle}</p>
          <p style="margin: 5px 0;"><strong>Importo:</strong> € ${amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
          ${validUntilText ? `<p style="margin: 5px 0;"><strong>${validUntilText}</strong></p>` : ''}
        </div>
        
        ${attachmentsList}
        
        <p style="color: #374151; line-height: 1.6;">
          In allegato trova il preventivo dettagliato in formato PDF con tutte le specifiche tecniche 
          e commerciali del prodotto/servizio proposto.
        </p>
        
        <p style="color: #374151; line-height: 1.6;">
          Rimaniamo a disposizione per qualsiasi chiarimento e per definire insieme i dettagli 
          della fornitura.
        </p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <p style="color: #374151; margin: 5px 0;">Cordiali saluti,</p>
          <p style="color: #1f2937; font-weight: bold; margin: 5px 0;">Il Team ZAPPER</p>
          
          <div style="margin-top: 20px; color: #6b7280; font-size: 12px;">
            <p>ZAPPER S.R.L.</p>
            <p>Via Esempio 123, 12345 Città</p>
            <p>Tel: +39 123 456 789 | Email: info@zapper.it</p>
            <p>P.IVA: 12345678901</p>
          </div>
        </div>
      </div>
    `;

    // Prepare attachments for Resend
    const resendAttachments = attachments.map(att => ({
      filename: att.filename,
      content: att.content
    }));

    const emailResponse = await resend.emails.send({
      from: "ZAPPER <offerte@zapper.it>",
      to: [to],
      subject: `Offerta Commerciale ${offerNumber} - ${offerTitle}`,
      html: htmlContent,
      attachments: resendAttachments
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      messageId: emailResponse.data?.id 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-offer-email function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Failed to send email" 
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);