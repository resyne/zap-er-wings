import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const IMAP_HOST = 'mail.abbattitorizapper.it';
const IMAP_PORT = 143;
const IMAP_USER = 'fatture@abbattitorizapper.it';
const IMAP_FOLDER = 'INBOX';
const MAX_EMAILS_PER_SYNC = 10;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const IMAP_PASSWORD = Deno.env.get('INVOICE_IMAP_PASSWORD');
    if (!IMAP_PASSWORD) throw new Error('INVOICE_IMAP_PASSWORD not configured');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting invoice email sync from', IMAP_USER);

    const conn = await connectToImap({ host: IMAP_HOST, port: IMAP_PORT, username: IMAP_USER, password: IMAP_PASSWORD });
    if (!conn) throw new Error('Failed to connect to IMAP server');

    let processedCount = 0;
    let newDrafts = 0;

    try {
      await readResponse(conn);
      await sendCommand(conn, `LOGIN "${IMAP_USER}" "${IMAP_PASSWORD}"`);
      await sendCommand(conn, `SELECT "${IMAP_FOLDER}"`);

      // Search for today's emails (catches both read and unread)
      const today = new Date();
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const imapDate = `${today.getDate()}-${months[today.getMonth()]}-${today.getFullYear()}`;
      const searchResponse = await sendCommand(conn, `SEARCH SINCE ${imapDate}`);
      const messageIds = extractMessageIds(searchResponse);
      console.log(`Found ${messageIds.length} emails since ${imapDate}`);

      const messagesToProcess = messageIds.slice(-MAX_EMAILS_PER_SYNC);

      for (const msgId of messagesToProcess) {
        try {
          const emailResponse = await sendCommand(conn, `FETCH ${msgId} (BODY.PEEK[] ENVELOPE)`);
          const parsed = parseEmail(emailResponse);

          if (!parsed.messageId) {
            parsed.messageId = `msg-${msgId}-${Date.now()}`;
          }

          // Check for PDF/XML attachments
          const attachments = extractAttachments(emailResponse);

          if (attachments.length === 0) {
            console.log(`Email ${msgId}: no invoice attachments found, skipping`);
            // Mark as seen
            await sendCommand(conn, `STORE ${msgId} +FLAGS (\\Seen)`);
            continue;
          }

          for (const attachment of attachments) {
            // Check if already processed
            const { data: existing } = await supabase
              .from('invoice_email_log')
              .select('id')
              .eq('email_message_id', parsed.messageId)
              .eq('attachment_filename', attachment.filename)
              .single();

            if (existing) {
              console.log(`Already processed: ${parsed.messageId} / ${attachment.filename}`);
              continue;
            }

            // Upload attachment to storage
            const storagePath = `invoice-emails/${new Date().toISOString().slice(0, 10)}/${Date.now()}_${attachment.filename}`;
            const { error: uploadError } = await supabase.storage
              .from('accounting-documents')
              .upload(storagePath, attachment.data, {
                contentType: attachment.contentType,
                upsert: true
              });

            if (uploadError) {
              console.error('Upload error:', uploadError);
              // Log failure
              await supabase.from('invoice_email_log').insert({
                email_message_id: parsed.messageId,
                email_subject: parsed.subject,
                email_from: parsed.from,
                email_date: parsed.date,
                attachment_filename: attachment.filename,
                status: 'failed',
                error_message: `Upload failed: ${uploadError.message}`
              }).single();
              continue;
            }

            // Use signed URL so AI can access the file
            const { data: urlData, error: signedUrlError } = await supabase.storage
              .from('accounting-documents')
              .createSignedUrl(storagePath, 3600); // 1 hour expiry
            const fileUrl = urlData?.signedUrl;
            if (signedUrlError || !fileUrl) {
              console.error('Signed URL error:', signedUrlError);
              continue;
            }

            // Log as pending
            const { data: logEntry } = await supabase.from('invoice_email_log').insert({
              email_message_id: parsed.messageId,
              email_subject: parsed.subject,
              email_from: parsed.from,
              email_date: parsed.date,
              attachment_filename: attachment.filename,
              attachment_url: fileUrl,
              status: 'processing'
            }).select('id').single();

            // Call analyze-accounting-document to extract data
            try {
              const analyzeUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-accounting-document`;
              const analyzeResp = await fetch(analyzeUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
                },
                body: JSON.stringify({
                  fileUrl,
                  fileName: attachment.filename,
                  fileType: attachment.contentType,
                })
              });

              if (!analyzeResp.ok) {
                const errText = await analyzeResp.text();
                throw new Error(`AI analysis failed (${analyzeResp.status}): ${errText}`);
              }

              const analyzeData = await analyzeResp.json();
              const extracted = analyzeData.extracted;

              if (extracted) {
                // Determine invoice type and subject type from AI classification
                let invoiceType = 'acquisto';
                let subjectType = 'fornitore';
                if (extracted.document_type === 'fattura_vendita') {
                  invoiceType = 'vendita';
                  subjectType = 'cliente';
                } else if (extracted.document_type === 'nota_credito') {
                  invoiceType = 'nota_credito';
                  subjectType = extracted.counterpart_name?.toLowerCase().includes('climatel') ? 'cliente' : 'fornitore';
                }

                // Create draft in invoice_registry
                const { data: invoiceEntry, error: invoiceError } = await supabase
                  .from('invoice_registry')
                  .insert({
                    invoice_number: extracted.invoice_number || `EMAIL-${Date.now()}`,
                    invoice_date: extracted.invoice_date || new Date().toISOString().slice(0, 10),
                    invoice_type: invoiceType,
                    subject_name: extracted.counterpart_name || parsed.from || 'Sconosciuto',
                    subject_type: subjectType,
                    subject_id: analyzeData.customerId || null,
                    imponibile: extracted.net_amount || 0,
                    iva_rate: extracted.vat_rate || 22,
                    iva_amount: extracted.vat_amount || 0,
                    total_amount: extracted.total_amount || 0,
                    due_date: extracted.due_date || null,
                    vat_regime: 'domestica_imponibile',
                    financial_status: 'da_pagare',
                    status: 'bozza',
                    attachment_url: fileUrl,
                    notes: `📧 Importata automaticamente da email: ${parsed.subject || 'N/A'}\nMittente: ${parsed.from || 'N/A'}\nConfidenza AI: ${Math.round((extracted.confidence || 0) * 100)}%`,
                    source_document_type: 'email',
                  })
                  .select('id')
                  .single();

                if (invoiceError) {
                  console.error('Error creating invoice draft:', invoiceError);
                  await supabase.from('invoice_email_log')
                    .update({ status: 'failed', error_message: invoiceError.message, ai_raw_data: extracted })
                    .eq('id', logEntry?.id);
                } else {
                  await supabase.from('invoice_email_log')
                    .update({
                      status: 'processed',
                      invoice_registry_id: invoiceEntry?.id,
                      ai_raw_data: extracted
                    })
                    .eq('id', logEntry?.id);
                  newDrafts++;
                  console.log(`Created draft invoice: ${extracted.invoice_number} from ${extracted.counterpart_name}`);
                }
              }
            } catch (aiError) {
              console.error('AI analysis error:', aiError);
              await supabase.from('invoice_email_log')
                .update({ status: 'failed', error_message: aiError instanceof Error ? aiError.message : 'Unknown AI error' })
                .eq('id', logEntry?.id);
            }
          }

          // Mark email as seen
          await sendCommand(conn, `STORE ${msgId} +FLAGS (\\Seen)`);
          processedCount++;
        } catch (msgError) {
          console.error(`Error processing message ${msgId}:`, msgError);
        }
      }

      await sendCommand(conn, 'LOGOUT');
    } finally {
      try { conn.close(); } catch (_) { /* ignore */ }
    }

    console.log(`Sync complete: ${processedCount} emails processed, ${newDrafts} drafts created`);

    return new Response(JSON.stringify({
      success: true,
      emails_processed: processedCount,
      drafts_created: newDrafts,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('sync-invoice-emails error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// ===== IMAP Helpers (reused from sync-call-records-imap pattern) =====

interface ImapConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

async function connectToImap(config: ImapConfig): Promise<Deno.TcpConn | null> {
  try {
    const conn = await Deno.connect({ hostname: config.host, port: config.port });
    if (config.port === 993) {
      return await Deno.startTls(conn, { hostname: config.host });
    }
    return conn;
  } catch (error) {
    console.error('IMAP connection failed:', error);
    return null;
  }
}

async function sendCommand(conn: Deno.TcpConn, command: string): Promise<string> {
  const encoder = new TextEncoder();
  const tag = 'A' + Math.floor(Math.random() * 1000);
  await conn.write(encoder.encode(`${tag} ${command}\r\n`));
  return await readResponse(conn);
}

async function readResponse(conn: Deno.TcpConn): Promise<string> {
  const decoder = new TextDecoder();
  const buffer = new Uint8Array(131072); // 128KB buffer for large emails
  let fullResponse = '';
  
  while (true) {
    const bytesRead = await conn.read(buffer);
    if (bytesRead === null) break;
    const chunk = decoder.decode(buffer.subarray(0, bytesRead));
    fullResponse += chunk;
    if (chunk.includes(' OK ') || chunk.includes(' NO ') || chunk.includes(' BAD ')) break;
  }
  
  return fullResponse;
}

function extractMessageIds(response: string): number[] {
  const searchMatch = response.match(/\* SEARCH (.+)/);
  if (!searchMatch) return [];
  return searchMatch[1].trim().split(' ').map(id => parseInt(id)).filter(id => !isNaN(id));
}

interface ParsedEmail {
  messageId: string;
  subject: string;
  from: string;
  date: string | null;
}

function parseEmail(response: string): ParsedEmail {
  const messageIdMatch = response.match(/Message-ID:\s*<([^>]+)>/i) || response.match(/Message-Id:\s*<([^>]+)>/i);
  const subjectMatch = response.match(/^Subject:\s*(.+?)$/im);
  const fromMatch = response.match(/^From:\s*(.+?)$/im);
  const dateMatch = response.match(/^Date:\s*(.+?)$/im);

  return {
    messageId: messageIdMatch?.[1] || '',
    subject: decodeHeader(subjectMatch?.[1] || ''),
    from: decodeHeader(fromMatch?.[1] || ''),
    date: dateMatch?.[1] || null,
  };
}

function decodeHeader(header: string): string {
  // Simple quoted-printable / base64 header decode
  return header
    .replace(/=\?[^?]+\?[BbQq]\?[^?]+\?=/g, (match) => {
      try {
        const parts = match.match(/=\?([^?]+)\?([BbQq])\?([^?]+)\?=/);
        if (!parts) return match;
        const encoding = parts[2].toUpperCase();
        const content = parts[3];
        if (encoding === 'B') {
          return atob(content);
        } else if (encoding === 'Q') {
          return content.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
        }
      } catch (_) { /* ignore decode errors */ }
      return match;
    })
    .trim();
}

interface Attachment {
  filename: string;
  contentType: string;
  data: Uint8Array;
}

function extractAttachments(response: string): Attachment[] {
  const attachments: Attachment[] = [];
  
  const boundaryMatch = response.match(/boundary="?([^"\r\n;]+)"?/i);
  if (!boundaryMatch) return attachments;

  const boundary = boundaryMatch[1];
  const parts = response.split('--' + boundary);

  for (const part of parts) {
    // Look for PDF or XML attachments
    const isPdf = part.toLowerCase().includes('application/pdf') || part.toLowerCase().includes('.pdf');
    const isXml = part.toLowerCase().includes('text/xml') || part.toLowerCase().includes('application/xml') || part.toLowerCase().includes('.xml');
    const isImage = part.toLowerCase().includes('image/jpeg') || part.toLowerCase().includes('image/png');

    if (!isPdf && !isXml && !isImage) continue;

    // Extract filename
    const filenameMatch = part.match(/filename="?([^"\r\n;]+)"?/i) || part.match(/name="?([^"\r\n;]+)"?/i);
    if (!filenameMatch) continue;
    let filename = decodeHeader(filenameMatch[1].trim()).replace(/[^a-zA-Z0-9._\-àèéìòùÀÈÉÌÒÙ]/g, '_');
    // Ensure file has proper extension for AI analysis
    if (isPdf && !filename.toLowerCase().endsWith('.pdf')) filename += '.pdf';
    if (isXml && !filename.toLowerCase().endsWith('.xml')) filename += '.xml';
    if (isImage && !filename.toLowerCase().endsWith('.png') && !filename.toLowerCase().endsWith('.jpg') && !filename.toLowerCase().endsWith('.jpeg')) filename += '.jpg';

    // Only process files that look like invoices
    const lowerFilename = filename.toLowerCase();
    const isInvoiceFile = isPdf || isXml || 
      lowerFilename.includes('fattur') || lowerFilename.includes('invoice') ||
      lowerFilename.includes('nota') || lowerFilename.includes('credit');

    if (!isInvoiceFile && isImage) continue; // Skip random images

    const isBase64 = part.toLowerCase().includes('content-transfer-encoding: base64');
    if (!isBase64) continue;

    const contentStart = part.search(/\r?\n\r?\n/);
    if (contentStart === -1) continue;

    let base64Content = part.substring(contentStart).trim();
    base64Content = base64Content.split('--')[0].replace(/\s/g, '');

    try {
      const binaryString = atob(base64Content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      let contentType = 'application/pdf';
      if (isXml) contentType = 'text/xml';
      else if (isImage) contentType = part.toLowerCase().includes('image/png') ? 'image/png' : 'image/jpeg';

      attachments.push({ filename, contentType, data: bytes });
      console.log(`Found attachment: ${filename} (${contentType}, ${bytes.length} bytes)`);
    } catch (e) {
      console.error(`Failed to decode attachment ${filename}:`, e);
    }
  }

  return attachments;
}
