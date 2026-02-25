import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const BRAND_PRIMARY = '#0066FF';
const BRAND_PRIMARY_DARK = '#0052CC';
const BRAND_BG = '#f0f4ff';
const CC_EMAIL = 'info@abbattitorizapper.it';

interface ServiceReportEmailRequest {
  recipientEmail: string;
  recipientName: string;
  customerName: string;
  technicianName: string;
  interventionDate: string;
  interventionType: string;
  workPerformed?: string;
  pdfBase64: string;
  fileName: string;
  senderEmail?: string;
}

function buildEmailHtml(recipientName: string, interventionDate: string, interventionType: string, technicianName: string, workPerformed?: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f4;">
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:40px 20px;">
      <table role="presentation" style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
        <tr><td style="background:linear-gradient(135deg,${BRAND_PRIMARY} 0%,${BRAND_PRIMARY_DARK} 100%);padding:30px;text-align:center;">
          <h2 style="color:#ffffff;margin:0;font-size:22px;font-weight:600;">ZAPPER - Assistenza Tecnica</h2>
          <p style="color:#ffffff;margin:5px 0 0;font-size:14px;opacity:0.95;">Rapporto di Intervento</p>
        </td></tr>
        <tr><td style="padding:40px 30px;">
          <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 15px;">
            Gentile <strong>${recipientName}</strong>,
          </p>
          <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 15px;">
            in allegato trova il rapporto di intervento del <strong>${interventionDate}</strong>.
          </p>
          <div style="background:${BRAND_BG};border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid ${BRAND_PRIMARY};">
            <p style="margin:0 0 5px;font-size:14px;"><strong>Tipo intervento:</strong> ${interventionType}</p>
            <p style="margin:0 0 5px;font-size:14px;"><strong>Tecnico:</strong> ${technicianName}</p>
            ${workPerformed ? `<p style="margin:0;font-size:14px;"><strong>Lavori eseguiti:</strong> ${workPerformed.substring(0, 200)}${workPerformed.length > 200 ? '...' : ''}</p>` : ''}
          </div>
          <p style="color:#333;font-size:15px;line-height:1.6;margin:15px 0 0;">
            Cordiali saluti,<br>
            <strong>Il Team ZAPPER</strong>
          </p>
        </td></tr>
        <tr><td style="background-color:#f8f8f8;padding:25px;border-top:3px solid ${BRAND_PRIMARY};">
          <div style="text-align:center;">
            <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:${BRAND_PRIMARY};">ZAPPER</p>
            <p style="margin:0 0 3px;font-size:11px;color:#666;">marchio commerciale della ditta CLIMATEL di Elefante Pasquale</p>
            <p style="margin:0 0 3px;font-size:11px;color:#888;">Via G. Ferraris n° 24 - 84018 SCAFATI (SA) - Italia</p>
            <p style="margin:0 0 3px;font-size:11px;color:#888;">C.F. LFNPQL67L02I483U | P.IVA 03895390650</p>
            <p style="margin:0;font-size:11px;">
              📧 <a href="mailto:info@abbattitorizapper.it" style="color:${BRAND_PRIMARY};text-decoration:none;">info@abbattitorizapper.it</a> |
              🌐 <a href="https://www.abbattitorizapper.it" style="color:${BRAND_PRIMARY};text-decoration:none;">www.abbattitorizapper.it</a>
            </p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: ServiceReportEmailRequest = await req.json();
    console.log('Service report email request for:', data.recipientEmail);

    if (!data.pdfBase64) {
      throw new Error('PDF base64 data is required');
    }

    const emailHtml = buildEmailHtml(
      data.recipientName,
      data.interventionDate,
      data.interventionType,
      data.technicianName,
      data.workPerformed
    );

    const fromEmail = data.senderEmail || 'noreply@erp.abbattitorizapper.it';
    console.log('Sending email to:', data.recipientEmail, 'CC:', CC_EMAIL);

    const emailResponse = await resend.emails.send({
      from: `ZAPPER Assistenza <${fromEmail}>`,
      to: [data.recipientEmail],
      cc: [CC_EMAIL],
      subject: `Rapporto di Intervento - ${data.interventionDate} - ${data.customerName}`,
      html: emailHtml,
      attachments: [
        {
          filename: data.fileName,
          content: data.pdfBase64,
          content_type: 'application/pdf',
        },
      ],
    });

    if (emailResponse.error) {
      console.error('Resend error:', emailResponse.error);
      throw new Error(emailResponse.error.message);
    }

    console.log('Email sent successfully:', emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email inviata a ${data.recipientEmail} con PDF in allegato (CC: ${CC_EMAIL})`,
        emailId: emailResponse.data?.id,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('Error in send-service-report-email:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

serve(handler);
