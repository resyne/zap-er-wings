import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

interface ImapConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

// Send email via SMTP and copy to Sent folder via IMAP
const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      from, 
      to, 
      subject, 
      body, 
      smtp_config, 
      imap_config 
    } = await req.json();
    
    // Connect to SMTP
    const smtpConn = await Deno.connect({
      hostname: smtp_config.host,
      port: smtp_config.port,
    });
    
    try {
      // SMTP communication
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      
      // Read greeting
      const buffer = new Uint8Array(1024);
      await smtpConn.read(buffer);
      
      // EHLO
      await smtpConn.write(encoder.encode(`EHLO ${smtp_config.host}\r\n`));
      await smtpConn.read(buffer);
      
      // AUTH LOGIN
      await smtpConn.write(encoder.encode('AUTH LOGIN\r\n'));
      await smtpConn.read(buffer);
      
      // Username
      await smtpConn.write(encoder.encode(btoa(smtp_config.user) + '\r\n'));
      await smtpConn.read(buffer);
      
      // Password
      await smtpConn.write(encoder.encode(btoa(smtp_config.pass) + '\r\n'));
      await smtpConn.read(buffer);
      
      // MAIL FROM
      await smtpConn.write(encoder.encode(`MAIL FROM:<${from}>\r\n`));
      await smtpConn.read(buffer);
      
      // RCPT TO
      await smtpConn.write(encoder.encode(`RCPT TO:<${to}>\r\n`));
      await smtpConn.read(buffer);
      
      // DATA
      await smtpConn.write(encoder.encode('DATA\r\n'));
      await smtpConn.read(buffer);
      
      // Email content
      const emailDate = new Date().toUTCString();
      const emailContent = `From: ${from}\r\nTo: ${to}\r\nSubject: ${subject}\r\nDate: ${emailDate}\r\n\r\n${body}\r\n.\r\n`;
      
      await smtpConn.write(encoder.encode(emailContent));
      await smtpConn.read(buffer);
      
      // QUIT
      await smtpConn.write(encoder.encode('QUIT\r\n'));
      
      console.log('Email sent successfully via SMTP');
      
      // Now copy to Sent folder via IMAP
      if (imap_config) {
        try {
          const imapConn = await Deno.connect({
            hostname: imap_config.host,
            port: imap_config.port,
          });
          
          // Use TLS if port is 993
          const conn = imap_config.port === 993 
            ? await Deno.startTls(imapConn, { hostname: imap_config.host })
            : imapConn;
          
          // Read greeting
          await conn.read(buffer);
          
          // LOGIN
          await conn.write(encoder.encode(`A001 LOGIN ${imap_config.user} ${imap_config.pass}\r\n`));
          await conn.read(buffer);
          
          // SELECT Sent folder
          await conn.write(encoder.encode('A002 SELECT "Sent"\r\n'));
          await conn.read(buffer);
          
          // Prepare message for APPEND
          const rawMessage = `From: ${from}\r\nTo: ${to}\r\nSubject: ${subject}\r\nDate: ${emailDate}\r\n\r\n${body}`;
          const messageSize = new TextEncoder().encode(rawMessage).length;
          
          // APPEND to Sent folder
          await conn.write(encoder.encode(`A003 APPEND "Sent" (\\Seen) {${messageSize}}\r\n`));
          await conn.read(buffer);
          
          await conn.write(encoder.encode(rawMessage + '\r\n'));
          await conn.read(buffer);
          
          // LOGOUT
          await conn.write(encoder.encode('A004 LOGOUT\r\n'));
          
          conn.close();
          
          console.log('Email copied to Sent folder via IMAP');
        } catch (imapError) {
          console.error('Failed to copy to Sent folder:', imapError);
          // Don't fail the whole operation if IMAP copy fails
        }
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Email sent and copied to Sent folder'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } finally {
      smtpConn.close();
    }
    
  } catch (error: any) {
    console.error('Error sending email:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

serve(handler);