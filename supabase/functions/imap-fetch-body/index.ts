import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImapConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

// Fetch full body on-demand (not cached)
const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imap_config, folder, uid } = await req.json();
    
    if (!imap_config || !folder || !uid) {
      return new Response(JSON.stringify({ error: 'Missing parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Connect to IMAP
    const conn = await Deno.connect({
      hostname: imap_config.host,
      port: imap_config.port,
    });
    
    const imapConn = imap_config.port === 993 
      ? await Deno.startTls(conn, { hostname: imap_config.host })
      : conn;
    
    try {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      
      // Read greeting
      const buffer = new Uint8Array(65536); // Large buffer for body
      await imapConn.read(buffer);
      
      // LOGIN
      await imapConn.write(encoder.encode(`A001 LOGIN ${imap_config.user} ${imap_config.pass}\r\n`));
      await imapConn.read(buffer);
      
      // SELECT folder
      await imapConn.write(encoder.encode(`A002 SELECT "${folder}"\r\n`));
      await imapConn.read(buffer);
      
      // FETCH body
      await imapConn.write(encoder.encode(`A003 UID FETCH ${uid} (BODY[TEXT] BODY[1])\r\n`));
      
      // Read full response
      let fullResponse = '';
      let totalBytes = 0;
      
      while (true) {
        const bytesRead = await imapConn.read(buffer);
        if (bytesRead === null) break;
        
        const chunk = decoder.decode(buffer.subarray(0, bytesRead));
        fullResponse += chunk;
        totalBytes += bytesRead;
        
        if (chunk.includes('A003 OK') || totalBytes > 524288) { // 512KB limit
          break;
        }
      }
      
      // Parse body from response
      const body = extractBody(fullResponse);
      
      // LOGOUT
      await imapConn.write(encoder.encode('A004 LOGOUT\r\n'));
      
      return new Response(JSON.stringify({
        success: true,
        body: body.text,
        html_body: body.html
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } finally {
      imapConn.close();
    }
    
  } catch (error: any) {
    console.error('Error fetching body:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

// Extract body content from IMAP response
function extractBody(response: string): { text: string; html: string } {
  const lines = response.split('\n');
  let text = '';
  let html = '';
  let inBody = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('BODY[TEXT]') || line.includes('BODY[1]')) {
      inBody = true;
      continue;
    }
    
    if (inBody) {
      if (line.startsWith(')') || line.includes('A003 OK')) {
        break;
      }
      
      text += line + '\n';
    }
  }
  
  // Simple cleanup
  text = text.trim();
  
  return { text, html: text }; // For now, treat both as same
}

serve(handler);