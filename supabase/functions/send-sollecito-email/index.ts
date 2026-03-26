import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SMTP_HOST = 'mail.abbattitorizapper.it';
const SMTP_PORT = 587;
const SMTP_USER = 'amministrazione@abbattitorizapper.it';
const FROM_EMAIL = 'amministrazione@abbattitorizapper.it';

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipient_email, subject, message, livello, soggetto_nome } = await req.json();

    if (!recipient_email) {
      return new Response(JSON.stringify({ error: 'Email destinatario mancante' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SMTP_PASS = Deno.env.get('AMMINISTRAZIONE_EMAIL_PASSWORD');
    if (!SMTP_PASS) {
      console.error('AMMINISTRAZIONE_EMAIL_PASSWORD not configured');
      return new Response(JSON.stringify({ error: 'Password email non configurata' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Sending sollecito (livello ${livello}) to ${recipient_email} for ${soggetto_nome}`);

    // Build HTML email
    const livelloLabels: Record<number, string> = {
      1: 'Promemoria di Pagamento',
      2: 'Secondo Sollecito di Pagamento',
      3: 'ULTIMO SOLLECITO - Avviso Formale',
    };

    const livelloColors: Record<number, string> = {
      1: '#3b82f6',
      2: '#f59e0b',
      3: '#ef4444',
    };

    const color = livelloColors[livello] || '#3b82f6';
    const title = livelloLabels[livello] || 'Sollecito di Pagamento';

    const htmlBody = `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background: #f5f5f5;">
  <div style="max-width: 650px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <div style="background: ${color}; padding: 20px 30px;">
      <h1 style="color: #fff; margin: 0; font-size: 20px;">${title}</h1>
      <p style="color: rgba(255,255,255,0.85); margin: 5px 0 0; font-size: 13px;">Abbattitori Zapper S.r.l.</p>
    </div>
    <div style="padding: 30px;">
      <pre style="font-family: Arial, sans-serif; white-space: pre-wrap; word-wrap: break-word; line-height: 1.6; margin: 0; font-size: 14px; color: #333;">${message}</pre>
    </div>
    <div style="padding: 15px 30px; background: #f9f9f9; border-top: 1px solid #eee; font-size: 11px; color: #999;">
      <p style="margin: 0;">Questa comunicazione è stata generata automaticamente dal sistema gestionale di Abbattitori Zapper S.r.l.</p>
    </div>
  </div>
</body>
</html>`;

    // Connect to SMTP and send
    const conn = await Deno.connect({ hostname: SMTP_HOST, port: SMTP_PORT });
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const buf = new Uint8Array(4096);

    const read = async () => {
      const n = await conn.read(buf);
      const resp = decoder.decode(buf.subarray(0, n || 0));
      console.log('SMTP <', resp.trim());
      return resp;
    };

    const write = async (cmd: string) => {
      console.log('SMTP >', cmd.trim());
      await conn.write(encoder.encode(cmd));
    };

    try {
      // Greeting
      await read();

      // EHLO
      await write(`EHLO mail.abbattitorizapper.it\r\n`);
      await read();

      // STARTTLS
      await write(`STARTTLS\r\n`);
      const starttlsResp = await read();

      let secureConn: Deno.TlsConn | null = null;

      if (starttlsResp.startsWith('220')) {
        secureConn = await Deno.startTls(conn, { hostname: SMTP_HOST });

        const secRead = async () => {
          const n = await secureConn!.read(buf);
          const resp = decoder.decode(buf.subarray(0, n || 0));
          console.log('SMTPS <', resp.trim());
          return resp;
        };
        const secWrite = async (cmd: string) => {
          console.log('SMTPS >', cmd.trim());
          await secureConn!.write(encoder.encode(cmd));
        };

        // Re-EHLO after STARTTLS
        await secWrite(`EHLO mail.abbattitorizapper.it\r\n`);
        await secRead();

        // AUTH LOGIN
        await secWrite(`AUTH LOGIN\r\n`);
        await secRead();
        await secWrite(btoa(SMTP_USER) + '\r\n');
        await secRead();
        await secWrite(btoa(SMTP_PASS) + '\r\n');
        const authResp = await secRead();

        if (!authResp.startsWith('235')) {
          throw new Error('Autenticazione SMTP fallita: ' + authResp);
        }

        // MAIL FROM
        await secWrite(`MAIL FROM:<${FROM_EMAIL}>\r\n`);
        await secRead();

        // RCPT TO
        await secWrite(`RCPT TO:<${recipient_email}>\r\n`);
        await secRead();

        // DATA
        await secWrite(`DATA\r\n`);
        await secRead();

        const boundary = `----=_Part_${Date.now()}`;
        const emailDate = new Date().toUTCString();
        const msgId = `<${Date.now()}.${Math.random().toString(36).substr(2)}@abbattitorizapper.it>`;

        const emailData = [
          `From: "Abbattitori Zapper S.r.l." <${FROM_EMAIL}>`,
          `To: ${recipient_email}`,
          `Subject: ${subject}`,
          `Date: ${emailDate}`,
          `Message-ID: ${msgId}`,
          `MIME-Version: 1.0`,
          `Content-Type: multipart/alternative; boundary="${boundary}"`,
          `X-Priority: ${livello >= 3 ? '1' : livello >= 2 ? '2' : '3'}`,
          ``,
          `--${boundary}`,
          `Content-Type: text/plain; charset=utf-8`,
          `Content-Transfer-Encoding: 8bit`,
          ``,
          message,
          ``,
          `--${boundary}`,
          `Content-Type: text/html; charset=utf-8`,
          `Content-Transfer-Encoding: 8bit`,
          ``,
          htmlBody,
          ``,
          `--${boundary}--`,
          ``,
          `.`,
        ].join('\r\n');

        await secWrite(emailData + '\r\n');
        await secRead();

        await secWrite(`QUIT\r\n`);
        secureConn.close();
      } else {
        // Fallback: no STARTTLS, plain AUTH
        await write(`AUTH LOGIN\r\n`);
        await read();
        await write(btoa(SMTP_USER) + '\r\n');
        await read();
        await write(btoa(SMTP_PASS) + '\r\n');
        const authResp = await read();

        if (!authResp.startsWith('235')) {
          throw new Error('Autenticazione SMTP fallita: ' + authResp);
        }

        await write(`MAIL FROM:<${FROM_EMAIL}>\r\n`);
        await read();
        await write(`RCPT TO:<${recipient_email}>\r\n`);
        await read();
        await write(`DATA\r\n`);
        await read();

        const emailDate = new Date().toUTCString();
        const emailContent = `From: "Abbattitori Zapper S.r.l." <${FROM_EMAIL}>\r\nTo: ${recipient_email}\r\nSubject: ${subject}\r\nDate: ${emailDate}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${htmlBody}\r\n.\r\n`;
        await write(emailContent);
        await read();

        await write(`QUIT\r\n`);
        conn.close();
      }

      console.log('Sollecito email sent successfully to', recipient_email);

      return new Response(JSON.stringify({
        success: true,
        message: `Sollecito livello ${livello} inviato a ${recipient_email}`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (smtpError) {
      try { conn.close(); } catch (_) {}
      throw smtpError;
    }

  } catch (error: any) {
    console.error('Error sending sollecito email:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);
