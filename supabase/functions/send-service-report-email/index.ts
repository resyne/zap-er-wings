import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Brand colors
const BRAND_PRIMARY = '#0066FF'; // HSL 220 100% 50%
const BRAND_PRIMARY_DARK = '#0052CC';
const BRAND_BG = '#f0f4ff';

const CC_EMAIL = 'info@abbattitorizapper.it';

interface ServiceReportEmailRequest {
  recipientEmail: string;
  recipientName: string;
  customer: {
    name: string;
    company_name?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    province?: string;
  };
  technician: {
    first_name: string;
    last_name: string;
    employee_code?: string;
  };
  techniciansList?: Array<{ name: string }>;
  formData: {
    intervention_date: string;
    start_time?: string;
    end_time?: string;
    intervention_type: string;
    description?: string;
    work_performed?: string;
    notes?: string;
    amount?: string;
    vat_rate?: string;
    total_amount?: string;
    kilometers?: string;
  };
  materialItems?: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    vat_rate: number;
  }>;
  workOrder?: {
    number: string;
    title: string;
  };
  customerSignature?: string;
  technicianSignature?: string;
  senderEmail?: string;
}

function buildPdfHtml(data: ServiceReportEmailRequest): string {
  const { customer, technician, formData, materialItems, workOrder, customerSignature, technicianSignature, techniciansList } = data;
  const techName = `${technician.first_name} ${technician.last_name}`;
  const numTechs = techniciansList?.length || 1;

  let materialsHtml = '';
  if (materialItems && materialItems.length > 0 && materialItems.some(m => m.description?.trim())) {
    let matNettoTotal = 0;
    let matIvaTotal = 0;
    const rows = materialItems.filter(m => m.description?.trim()).map(item => {
      const netto = item.quantity * item.unit_price;
      const iva = netto * item.vat_rate / 100;
      matNettoTotal += netto;
      matIvaTotal += iva;
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${item.description}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${item.unit_price > 0 ? `€${item.unit_price.toFixed(2)}` : '-'}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.vat_rate}%</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:right;">${item.unit_price > 0 ? `€${(netto + iva).toFixed(2)}` : '-'}</td>
      </tr>`;
    }).join('');

    materialsHtml = `
      <div style="margin-top:20px;">
        <h3 style="color:${BRAND_PRIMARY};font-size:14px;margin:0 0 10px;border-bottom:2px solid ${BRAND_PRIMARY};padding-bottom:5px;">Materiali Utilizzati</h3>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr style="background:${BRAND_BG};">
              <th style="padding:8px;text-align:left;border-bottom:2px solid ${BRAND_PRIMARY};">Descrizione</th>
              <th style="padding:8px;text-align:center;border-bottom:2px solid ${BRAND_PRIMARY};">Qtà</th>
              <th style="padding:8px;text-align:right;border-bottom:2px solid ${BRAND_PRIMARY};">Prezzo</th>
              <th style="padding:8px;text-align:center;border-bottom:2px solid ${BRAND_PRIMARY};">IVA</th>
              <th style="padding:8px;text-align:right;border-bottom:2px solid ${BRAND_PRIMARY};">Totale</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          ${matNettoTotal > 0 ? `<tfoot>
            <tr style="background:${BRAND_BG};font-weight:bold;">
              <td colspan="2" style="padding:8px;">Totale Materiali</td>
              <td style="padding:8px;text-align:right;">€${matNettoTotal.toFixed(2)}</td>
              <td style="padding:8px;text-align:right;">€${matIvaTotal.toFixed(2)}</td>
              <td style="padding:8px;text-align:right;">€${(matNettoTotal + matIvaTotal).toFixed(2)}</td>
            </tr>
          </tfoot>` : ''}
        </table>
      </div>`;
  }

  const economicsHtml = formData.amount ? `
    <div style="margin-top:20px;background:${BRAND_BG};border-radius:6px;padding:15px;border-left:4px solid ${BRAND_PRIMARY};">
      <h3 style="color:${BRAND_PRIMARY};font-size:14px;margin:0 0 10px;">Dettagli Economici</h3>
      <table style="font-size:12px;">
        <tr><td style="padding:3px 15px 3px 0;color:#666;">Imponibile:</td><td style="font-weight:600;">€${parseFloat(formData.amount).toFixed(2)}</td></tr>
        <tr><td style="padding:3px 15px 3px 0;color:#666;">IVA (${parseFloat(formData.vat_rate || '22').toFixed(0)}%):</td><td style="font-weight:600;">€${(parseFloat(formData.total_amount || '0') - parseFloat(formData.amount)).toFixed(2)}</td></tr>
        <tr><td style="padding:3px 15px 3px 0;color:#666;font-weight:700;font-size:14px;">Totale:</td><td style="font-weight:700;font-size:14px;color:${BRAND_PRIMARY};">€${parseFloat(formData.total_amount || '0').toFixed(2)}</td></tr>
      </table>
    </div>` : '';

  const signaturesHtml = (customerSignature || technicianSignature) ? `
    <div style="margin-top:30px;display:flex;gap:40px;">
      <div style="flex:1;">
        <p style="font-weight:600;font-size:12px;margin:0 0 5px;color:#333;">Firma Cliente:</p>
        ${customerSignature ? `<img src="${customerSignature}" style="max-width:200px;max-height:80px;border:1px solid #e5e7eb;border-radius:4px;" />` : '<div style="height:60px;border-bottom:1px solid #999;width:180px;"></div>'}
      </div>
      <div style="flex:1;">
        <p style="font-weight:600;font-size:12px;margin:0 0 5px;color:#333;">Firma Tecnico:</p>
        ${technicianSignature ? `<img src="${technicianSignature}" style="max-width:200px;max-height:80px;border:1px solid #e5e7eb;border-radius:4px;" />` : '<div style="height:60px;border-bottom:1px solid #999;width:180px;"></div>'}
      </div>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><style>
  @page { margin: 15mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #333; margin: 0; padding: 0; }
</style></head>
<body>
  <!-- Header -->
  <table style="width:100%;margin-bottom:20px;">
    <tr>
      <td style="width:50%;">
        <img src="https://rucjkoleodtwrbftwgsm.supabase.co/storage/v1/object/public/brand-assets/logo-zapper.png" alt="ZAPPER" style="max-height:50px;" />
      </td>
      <td style="width:50%;text-align:right;">
        <div style="background:${BRAND_PRIMARY};color:white;display:inline-block;padding:8px 20px;border-radius:4px;font-size:16px;font-weight:700;">
          RAPPORTO DI INTERVENTO
        </div>
      </td>
    </tr>
  </table>

  <!-- Info Grid -->
  <table style="width:100%;margin-bottom:20px;border-collapse:collapse;">
    <tr>
      <td style="width:50%;vertical-align:top;padding-right:15px;">
        <div style="background:${BRAND_BG};border-radius:6px;padding:12px;border-left:4px solid ${BRAND_PRIMARY};">
          <h3 style="color:${BRAND_PRIMARY};font-size:13px;margin:0 0 8px;">Cliente</h3>
          <p style="margin:0 0 3px;font-weight:600;">${customer.name}</p>
          ${customer.company_name && customer.company_name !== customer.name ? `<p style="margin:0 0 3px;">${customer.company_name}</p>` : ''}
          ${customer.phone ? `<p style="margin:0 0 3px;font-size:11px;">📞 ${customer.phone}</p>` : ''}
          ${customer.email ? `<p style="margin:0 0 3px;font-size:11px;">📧 ${customer.email}</p>` : ''}
          ${customer.address ? `<p style="margin:0;font-size:11px;">📍 ${[customer.address, customer.city, customer.province].filter(Boolean).join(', ')}</p>` : ''}
        </div>
      </td>
      <td style="width:50%;vertical-align:top;">
        <div style="background:${BRAND_BG};border-radius:6px;padding:12px;border-left:4px solid ${BRAND_PRIMARY};">
          <h3 style="color:${BRAND_PRIMARY};font-size:13px;margin:0 0 8px;">Dettagli Intervento</h3>
          <p style="margin:0 0 3px;">📅 <strong>Data:</strong> ${formData.intervention_date}</p>
          ${formData.start_time && formData.end_time ? `<p style="margin:0 0 3px;">🕐 <strong>Orario:</strong> ${formData.start_time} - ${formData.end_time}</p>` : ''}
          <p style="margin:0 0 3px;">🔧 <strong>Tipo:</strong> ${formData.intervention_type}</p>
          <p style="margin:0 0 3px;">👤 <strong>Tecnico:</strong> ${techName}</p>
          <p style="margin:0 0 3px;">👥 <strong>N. Tecnici:</strong> ${numTechs}</p>
          ${parseFloat(formData.kilometers || '0') > 0 ? `<p style="margin:0;">🚗 <strong>Km:</strong> ${formData.kilometers}</p>` : ''}
        </div>
      </td>
    </tr>
  </table>

  ${workOrder ? `<p style="margin:0 0 15px;font-size:12px;"><strong style="color:${BRAND_PRIMARY};">Commessa:</strong> ${workOrder.number} - ${workOrder.title}</p>` : ''}

  ${formData.description ? `
    <div style="margin-bottom:15px;">
      <h3 style="color:${BRAND_PRIMARY};font-size:14px;margin:0 0 8px;border-bottom:2px solid ${BRAND_PRIMARY};padding-bottom:5px;">Descrizione Problema</h3>
      <p style="margin:0;line-height:1.5;">${formData.description.replace(/\n/g, '<br>')}</p>
    </div>` : ''}

  ${formData.work_performed ? `
    <div style="margin-bottom:15px;">
      <h3 style="color:${BRAND_PRIMARY};font-size:14px;margin:0 0 8px;border-bottom:2px solid ${BRAND_PRIMARY};padding-bottom:5px;">Lavori Eseguiti</h3>
      <p style="margin:0;line-height:1.5;">${formData.work_performed.replace(/\n/g, '<br>')}</p>
    </div>` : ''}

  ${materialsHtml}
  ${economicsHtml}

  ${formData.notes ? `
    <div style="margin-top:15px;">
      <h3 style="color:${BRAND_PRIMARY};font-size:14px;margin:0 0 8px;border-bottom:2px solid ${BRAND_PRIMARY};padding-bottom:5px;">Note</h3>
      <p style="margin:0;line-height:1.5;">${formData.notes.replace(/\n/g, '<br>')}</p>
    </div>` : ''}

  <!-- Terms -->
  <div style="margin-top:25px;font-size:8px;color:#888;border-top:1px solid #e5e7eb;padding-top:10px;">
    <p style="font-weight:700;margin:0 0 5px;">TERMINI E CONDIZIONI</p>
    <p style="margin:0 0 2px;">1. Costo manodopera: le tariffe orarie sono calcolate secondo il listino vigente, con minimo di 1 ora per intervento.</p>
    <p style="margin:0 0 2px;">2. Costi chilometrici: il rimborso chilometrico viene calcolato dalla sede operativa al luogo dell'intervento (A/R).</p>
    <p style="margin:0 0 2px;">3. Diritto di chiamata: ogni intervento prevede un diritto fisso di chiamata come da listino.</p>
    <p style="margin:0 0 2px;">4. Materiali: i materiali utilizzati vengono fatturati separatamente secondo listino, salvo diverso accordo scritto.</p>
    <p style="margin:0 0 2px;">5. Orari straordinari: interventi in orario notturno, festivo o prefestivo prevedono una maggiorazione secondo listino.</p>
    <p style="margin:0 0 2px;">6. Pagamento: salvo diversi accordi, il pagamento è da effettuarsi entro 30 giorni dalla data di emissione della fattura.</p>
    <p style="margin:0 0 2px;">7. Garanzia lavori: i lavori eseguiti sono garantiti per 12 mesi dalla data dell'intervento, salvo usura normale.</p>
  </div>

  ${signaturesHtml}

  <!-- Footer -->
  <div style="margin-top:30px;border-top:3px solid ${BRAND_PRIMARY};padding-top:10px;text-align:center;font-size:9px;color:#666;">
    <p style="margin:0 0 2px;font-weight:700;color:${BRAND_PRIMARY};">ZAPPER</p>
    <p style="margin:0 0 2px;">marchio commerciale della ditta CLIMATEL di Elefante Pasquale</p>
    <p style="margin:0 0 2px;">Via G. Ferraris n° 24 - 84018 SCAFATI (SA) - Italia</p>
    <p style="margin:0 0 2px;">C.F. LFNPQL67L02I483U | P.IVA 03895390650</p>
    <p style="margin:0;">🌐 www.abbattitorizapper.it | 📞 08119968436</p>
  </div>
</body>
</html>`;
}

function buildEmailHtml(recipientName: string, formData: any, techName: string): string {
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
            in allegato trova il rapporto di intervento del <strong>${formData.intervention_date}</strong>.
          </p>
          <div style="background:${BRAND_BG};border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid ${BRAND_PRIMARY};">
            <p style="margin:0 0 5px;font-size:14px;"><strong>Tipo intervento:</strong> ${formData.intervention_type}</p>
            <p style="margin:0 0 5px;font-size:14px;"><strong>Tecnico:</strong> ${techName}</p>
            ${formData.work_performed ? `<p style="margin:0;font-size:14px;"><strong>Lavori eseguiti:</strong> ${formData.work_performed.substring(0, 200)}${formData.work_performed.length > 200 ? '...' : ''}</p>` : ''}
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

    // 1. Generate PDF HTML
    const pdfHtml = buildPdfHtml(data);

    // 2. Generate PDF via PDFBolt
    const PDFBOLT_API_KEY = Deno.env.get('PDFBOLT_API_KEY');
    if (!PDFBOLT_API_KEY) {
      throw new Error('PDFBOLT_API_KEY not configured');
    }

    console.log('Generating PDF via PDFBolt...');
    const pdfResponse = await fetch('https://api.pdfbolt.io/v1/pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PDFBOLT_API_KEY}`,
      },
      body: JSON.stringify({
        html: pdfHtml,
        format: 'A4',
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
        printBackground: true,
        scale: 1,
      }),
    });

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text();
      console.error('PDF generation failed:', errorText);
      throw new Error(`PDF generation failed: ${pdfResponse.status}`);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = btoa(
      new Uint8Array(pdfBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    console.log('PDF generated, size:', pdfBuffer.byteLength, 'bytes');

    // 3. Build email HTML
    const techName = `${data.technician.first_name} ${data.technician.last_name}`;
    const emailHtml = buildEmailHtml(data.recipientName, data.formData, techName);
    const fileName = `Rapporto_Intervento_${data.formData.intervention_date}_${data.customer.name.replace(/\s+/g, '_')}.pdf`;

    // 4. Send email via Resend with PDF attachment + CC
    const fromEmail = data.senderEmail || 'noreply@erp.abbattitorizapper.it';
    console.log('Sending email to:', data.recipientEmail, 'CC:', CC_EMAIL);

    const emailResponse = await resend.emails.send({
      from: `ZAPPER Assistenza <${fromEmail}>`,
      to: [data.recipientEmail],
      cc: [CC_EMAIL],
      subject: `Rapporto di Intervento - ${data.formData.intervention_date} - ${data.customer.name}`,
      html: emailHtml,
      attachments: [
        {
          filename: fileName,
          content: pdfBase64,
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
