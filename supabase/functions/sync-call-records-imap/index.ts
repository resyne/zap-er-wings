import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImapConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  folder: string;
}

interface CallRecordData {
  caller_number: string;
  called_number: string;
  service: string;
  call_date: string;
  call_time: string;
  duration_seconds: number;
  unique_call_id: string;
  extension_number?: string;
  direction?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting IMAP sync for call records (cron job)...');

    // Get all active PBX numbers with their IMAP configurations
    const { data: pbxNumbers, error: pbxError } = await supabase
      .from('pbx_numbers')
      .select('*')
      .eq('is_active', true);

    if (pbxError) {
      console.error('Error fetching PBX numbers:', pbxError);
      throw pbxError;
    }

    if (!pbxNumbers || pbxNumbers.length === 0) {
      console.log('No active PBX numbers found');
      return new Response(
        JSON.stringify({ message: 'No active PBX numbers configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    for (const pbx of pbxNumbers) {
      // Skip if no IMAP config
      if (!pbx.imap_host || !pbx.imap_username || !pbx.imap_password) {
        console.log(`Skipping PBX ${pbx.name}: No IMAP configuration`);
        results.push({ pbx_id: pbx.id, name: pbx.name, status: 'skipped', reason: 'No IMAP config' });
        continue;
      }

      try {
        console.log(`Processing PBX: ${pbx.name} (${pbx.pbx_number})`);
        const result = await syncPbxEmails(supabase, pbx);
        results.push({ pbx_id: pbx.id, name: pbx.name, ...result });
      } catch (error) {
        console.error(`Error syncing PBX ${pbx.name}:`, error);
        results.push({ pbx_id: pbx.id, name: pbx.name, status: 'error', error: error.message });
      }
    }

    // Also check legacy imap_config table for backward compatibility
    const { data: legacyConfigs } = await supabase
      .from('imap_config')
      .select('*')
      .eq('is_active', true);

    if (legacyConfigs && legacyConfigs.length > 0) {
      for (const config of legacyConfigs) {
        try {
          console.log(`Processing legacy config: ${config.name}`);
          const result = await syncLegacyConfig(supabase, config);
          results.push({ config_id: config.id, name: config.name, type: 'legacy', ...result });
        } catch (error) {
          console.error(`Error syncing legacy config ${config.name}:`, error);
          results.push({ config_id: config.id, name: config.name, type: 'legacy', status: 'error', error: error.message });
        }
      }
    }

    console.log('Sync complete:', JSON.stringify(results));

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in IMAP sync cron:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Sync emails for a specific PBX number
async function syncPbxEmails(supabase: any, pbx: any) {
  const imapConfig: ImapConfig = {
    host: pbx.imap_host,
    port: pbx.imap_port || 993,
    username: pbx.imap_username,
    password: pbx.imap_password,
    folder: pbx.imap_folder || 'INBOX'
  };

  const conn = await connectToImap(imapConfig);
  if (!conn) {
    throw new Error('Failed to connect to IMAP server');
  }

  try {
    // Read greeting
    await readResponse(conn);
    
    // Authenticate
    await sendCommand(conn, `LOGIN "${imapConfig.username}" "${imapConfig.password}"`);
    
    // Select folder
    await sendCommand(conn, `SELECT "${imapConfig.folder}"`);
    
    // Search for recent emails (last 7 days) - use SINCE instead of UNSEEN to handle pre-read emails
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateStr = `${sevenDaysAgo.getDate()}-${months[sevenDaysAgo.getMonth()]}-${sevenDaysAgo.getFullYear()}`;
    const searchCriteria = pbx.imap_search_criteria || `SINCE ${dateStr}`;
    console.log(`Search criteria: ${searchCriteria}`);
    const searchResponse = await sendCommand(conn, `SEARCH ${searchCriteria}`);
    const messageIds = extractMessageIds(searchResponse);

    console.log(`Found ${messageIds.length} messages for PBX ${pbx.name}`);

    // Get extensions for this PBX to match calls to users
    const { data: extensions } = await supabase
      .from('phone_extensions')
      .select('extension_number, user_id, profiles(full_name)')
      .eq('pbx_id', pbx.id);

    const extensionMap = new Map();
    if (extensions) {
      for (const ext of extensions) {
        extensionMap.set(ext.extension_number, {
          user_id: ext.user_id,
          user_name: ext.profiles?.full_name
        });
      }
    }

    // Limit to 50 messages per sync
    const MAX_MESSAGES_PER_SYNC = 50;
    const messagesToProcess = messageIds.slice(0, MAX_MESSAGES_PER_SYNC);

    let processedCount = 0;
    let newCallRecords = 0;

    for (const msgId of messagesToProcess) {
      try {
        const emailResponse = await sendCommand(conn, `FETCH ${msgId} (BODY.PEEK[])`);
        const emailData = parseEmailBody(emailResponse);
        const callData = extractCallRecordData(emailData.body);

        if (callData) {
          // Check if record exists
          const { data: existing } = await supabase
            .from('call_records')
            .select('id')
            .eq('unique_call_id', callData.unique_call_id)
            .single();

          if (!existing) {
            // Try to match extension to user
            let operatorId = null;
            let operatorName = null;
            
            if (callData.extension_number && extensionMap.has(callData.extension_number)) {
              const extData = extensionMap.get(callData.extension_number);
              operatorId = extData.user_id;
              operatorName = extData.user_name;
            }

            // Try to find matching lead by phone number
            const leadMatch = await findLeadByPhone(supabase, callData.caller_number, callData.direction);

            const { error: insertError } = await supabase
              .from('call_records')
              .insert({
                caller_number: callData.caller_number,
                called_number: callData.called_number,
                service: callData.service || pbx.name,
                call_date: callData.call_date,
                call_time: callData.call_time,
                duration_seconds: callData.duration_seconds,
                unique_call_id: callData.unique_call_id,
                extension_number: callData.extension_number,
                direction: callData.direction,
                operator_id: operatorId,
                operator_name: operatorName,
                lead_id: leadMatch?.id || null,
                matched_by: leadMatch?.matched_by || null,
                recording_url: null
              });

            if (!insertError) {
              newCallRecords++;
              
              // Get the inserted record ID for AI analysis
              const { data: insertedRecord } = await supabase
                .from('call_records')
                .select('id')
                .eq('unique_call_id', callData.unique_call_id)
                .single();
              
              if (insertedRecord) {
                // Trigger AI analysis asynchronously
                triggerAIAnalysis(insertedRecord.id, callData);
              }
            } else {
              console.error('Insert error:', insertError);
            }
          }

          processedCount++;
        }
      } catch (error) {
        console.error(`Error processing message ${msgId}:`, error);
      }
    }

    // Update last sync time
    await supabase
      .from('pbx_numbers')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', pbx.id);

    await sendCommand(conn, 'LOGOUT');

    return {
      status: 'success',
      emails_processed: processedCount,
      new_call_records: newCallRecords,
      total_found: messageIds.length
    };

  } finally {
    try {
      conn.close();
    } catch (e) {
      // Ignore close errors
    }
  }
}

// Sync legacy imap_config (backward compatibility)
async function syncLegacyConfig(supabase: any, config: any) {
  // Use SINCE to search emails from last 7 days - handles pre-read emails
  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dateStr = `${sevenDaysAgo.getDate()}-${months[sevenDaysAgo.getMonth()]}-${sevenDaysAgo.getFullYear()}`;
  const searchCriteria = `SINCE ${dateStr}`;
  console.log(`Config ${config.name} using search criteria: ${searchCriteria}`);

  const imapConfig: ImapConfig = {
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password_encrypted,
    folder: config.folder || 'INBOX'
  };

  const conn = await connectToImap(imapConfig);
  if (!conn) {
    throw new Error('Failed to connect to IMAP server');
  }

  try {
    await readResponse(conn);
    await sendCommand(conn, `LOGIN "${imapConfig.username}" "${imapConfig.password}"`);
    await sendCommand(conn, `SELECT "${imapConfig.folder}"`);

    const searchResponse = await sendCommand(conn, `SEARCH ${searchCriteria}`);
    const messageIds = extractMessageIds(searchResponse);

    // Limit to 10 messages per sync to avoid CPU timeout
    const MAX_MESSAGES_PER_SYNC = 10;
    const messagesToProcess = messageIds.slice(-MAX_MESSAGES_PER_SYNC); // Take most recent

    let processedCount = 0;
    let newCallRecords = 0;

    for (const msgId of messagesToProcess) {
      try {
        const emailResponse = await sendCommand(conn, `FETCH ${msgId} (BODY.PEEK[])`);
        const emailData = parseEmailBody(emailResponse);
        const callData = extractCallRecordData(emailData.body);

        if (callData) {
          const { data: existing } = await supabase
            .from('call_records')
            .select('id')
            .eq('unique_call_id', callData.unique_call_id)
            .single();

          if (!existing) {
            // Try to find matching lead by phone number
            const leadMatch = await findLeadByPhone(supabase, callData.caller_number, callData.direction);
            
            const { error: insertError } = await supabase
              .from('call_records')
              .insert({
                caller_number: callData.caller_number,
                called_number: callData.called_number,
                service: callData.service,
                call_date: callData.call_date,
                call_time: callData.call_time,
                duration_seconds: callData.duration_seconds,
                unique_call_id: callData.unique_call_id,
                extension_number: callData.extension_number,
                direction: callData.direction,
                lead_id: leadMatch?.id || null,
                matched_by: leadMatch?.matched_by || null
              });

            if (!insertError) {
              newCallRecords++;
              
              // Get the inserted record ID for AI analysis
              const { data: insertedRecord } = await supabase
                .from('call_records')
                .select('id')
                .eq('unique_call_id', callData.unique_call_id)
                .single();
              
              if (insertedRecord) {
                // Trigger AI analysis asynchronously
                triggerAIAnalysis(insertedRecord.id, callData);
              }
            }
          }
          processedCount++;
        }
        
        // Mark email as read (SEEN) after processing to avoid reprocessing
        await sendCommand(conn, `STORE ${msgId} +FLAGS (\\Seen)`);
        
      } catch (error) {
        console.error(`Error processing message ${msgId}:`, error);
      }
    }

    await supabase
      .from('imap_config')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', config.id);

    await sendCommand(conn, 'LOGOUT');

    return {
      status: 'success',
      emails_processed: processedCount,
      new_call_records: newCallRecords,
      total_found: messageIds.length
    };

  } finally {
    try {
      conn.close();
    } catch (e) {}
  }
}

// Normalizza numero italiano rimuovendo prefissi internazionali e caratteri speciali
function normalizeItalianPhone(phone: string): string {
  if (!phone) return '';
  // Rimuovi spazi, trattini, parentesi, punti
  let normalized = phone.replace(/[\s\-\(\)\.\+]/g, '');
  // Rimuovi prefisso internazionale italiano (39, 0039)
  if (normalized.startsWith('0039')) {
    normalized = normalized.slice(4);
  } else if (normalized.startsWith('39') && normalized.length > 10) {
    normalized = normalized.slice(2);
  }
  return normalized;
}

// Find lead by phone number - normalizes and searches with Italian phone handling
async function findLeadByPhone(supabase: any, phoneNumber: string, direction?: string): Promise<{ id: string; matched_by: string } | null> {
  if (!phoneNumber || phoneNumber.length < 6) return null;
  
  const normalized = normalizeItalianPhone(phoneNumber);
  
  // Genera pattern di ricerca - usa segmenti più corti per gestire spazi nel DB
  const searchPatterns: string[] = [];
  
  if (normalized.length >= 6) {
    // Ultimi 6-8 digit sono sufficientemente unici e funzionano anche con spazi
    const last6 = normalized.slice(-6);
    const last7 = normalized.slice(-7);
    const last8 = normalized.slice(-8);
    searchPatterns.push(last6);
    searchPatterns.push(last7);
    searchPatterns.push(last8);
    searchPatterns.push(normalized); // Pattern completo come fallback
  }
  
  console.log(`Searching for lead with patterns:`, searchPatterns.slice(0, 4));
  
  // Search in leads table - cerca pattern brevi che funzionano anche con spazi
  for (const pattern of searchPatterns) {
    if (!pattern || pattern.length < 6) continue;
    
    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .filter('phone', 'ilike', `%${pattern}%`)
      .limit(1)
      .single();
    
    if (lead) {
      console.log(`Found lead ${lead.id} matching phone pattern: ${pattern}`);
      return { id: lead.id, matched_by: 'phone' };
    }
  }
  
  return null;
}

async function connectToImap(config: ImapConfig): Promise<Deno.TcpConn | null> {
  try {
    const conn = await Deno.connect({
      hostname: config.host,
      port: config.port,
    });
    
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
  const buffer = new Uint8Array(65536);
  let fullResponse = '';
  
  while (true) {
    const bytesRead = await conn.read(buffer);
    if (bytesRead === null) break;
    
    const chunk = decoder.decode(buffer.subarray(0, bytesRead));
    fullResponse += chunk;
    
    if (chunk.includes(' OK ') || chunk.includes(' NO ') || chunk.includes(' BAD ')) {
      break;
    }
  }
  
  return fullResponse;
}

function extractMessageIds(response: string): number[] {
  const searchMatch = response.match(/\* SEARCH (.+)/);
  if (!searchMatch) return [];
  
  return searchMatch[1]
    .trim()
    .split(' ')
    .map(id => parseInt(id))
    .filter(id => !isNaN(id));
}

function parseEmailBody(response: string): { body: string } {
  // Try to find call data patterns directly anywhere in the email
  // Pattern 1: Outbound calls with "ID Univoco Chiamata"
  const outboundMatch = response.match(/Numero Chiamante:\s*[^\r\n]+[\s\S]*?ID Univoco Chiamata:\s*[^\r\n]+/i);
  if (outboundMatch) {
    console.log('Found outbound call data pattern');
    return { body: outboundMatch[0] };
  }
  
  // Pattern 2: Inbound calls with "ID Chiamata" (without "Univoco")
  const inboundMatch = response.match(/Numero Chiamante:\s*[^\r\n]+[\s\S]*?ID Chiamata:\s*[^\r\n]+/i);
  if (inboundMatch) {
    console.log('Found inbound call data pattern');
    return { body: inboundMatch[0] };
  }
  
  // Look for text/plain section and try to decode it
  // The email is multipart - find the text/plain part between boundaries
  const boundaryMatch = response.match(/boundary="?([^"\r\n]+)"?/i);
  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = response.split('--' + boundary);
    
    for (const part of parts) {
      // Find text/plain part
      if (part.includes('Content-Type: text/plain') || part.includes('content-type: text/plain')) {
        // Check encoding
        const isBase64 = part.toLowerCase().includes('content-transfer-encoding: base64');
        const isQP = part.toLowerCase().includes('content-transfer-encoding: quoted-printable');
        
        // Find content after headers (double newline)
        const contentStart = part.search(/\r?\n\r?\n/);
        if (contentStart > -1) {
          let content = part.substring(contentStart).trim();
          // Remove trailing boundary marker
          content = content.split('--')[0].trim();
          
          if (isBase64) {
            try {
              content = atob(content.replace(/\s/g, ''));
              console.log('Decoded base64 text/plain:', content.substring(0, 200));
            } catch (e) {
              console.log('Base64 decode failed');
            }
          } else if (isQP) {
            content = decodeQuotedPrintable(content);
            console.log('Decoded QP text/plain:', content.substring(0, 200));
          }
          
          return { body: content };
        }
      }
    }
  }
  
  // Last resort: return the raw response but log a sample from deeper in the content
  console.log('No structured content found, raw sample at 1000:', response.substring(1000, 1500));
  return { body: response };
}

function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, '') // Remove soft line breaks
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function extractCallRecordData(emailBody: string): CallRecordData | null {
  // Clean up the body: remove HTML tags, decode entities, normalize whitespace
  let cleanBody = emailBody
    .replace(/<br\s*\/?>/gi, '\n')           // Convert <br> to newline
    .replace(/<[^>]+>/g, ' ')                 // Remove all HTML tags (replace with space to preserve structure)
    .replace(/&lt;/gi, '<')                   // Decode common HTML entities
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num))) // Numeric entities
    .replace(/&[a-z]+;/gi, ' ')               // Remove remaining HTML entities
    .replace(/=\r?\n/g, '')                   // Remove quoted-printable soft breaks
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))) // Decode QP
    .replace(/[<>=]/g, ' ')                   // Remove stray angle brackets and equals signs
    .replace(/\s+/g, ' ')                     // Normalize whitespace
    .trim();

  console.log('Clean body for parsing:', cleanBody.substring(0, 400));

  // Extract values - use non-greedy matching and stop at next field or end
  const callerMatch = cleanBody.match(/Numero Chiamante:\s*([+\d]+)/i);
  const calledMatch = cleanBody.match(/Numero Chiamato:\s*([+\d]+)/i);
  const serviceMatch = cleanBody.match(/Servizio:\s*([\w_\d]+)/i); // Allow letters for service names like "Chiamate_OUT"
  const dateMatch = cleanBody.match(/Data:\s*([\d\/-]+)/i);
  const timeMatch = cleanBody.match(/Ora:\s*([\d:\-]+)/i);
  const durationMatch = cleanBody.match(/Durata:\s*([\d.,]+)\s*Secondi/i);
  
  // Try both ID formats: "ID Univoco Chiamata" (outbound) and "ID Chiamata" (inbound)
  // Be more flexible with matching - allow spaces and various characters before the ID
  let idMatch = cleanBody.match(/ID Univoco Chiamata[:\s]+(\d+\.?\d*)/i);
  if (!idMatch) {
    idMatch = cleanBody.match(/ID Chiamata[:\s]+(\d+\.?\d*)/i);
  }
  
  // If still no match, try to find any numeric ID pattern near the end of the string
  if (!idMatch) {
    // Look for the typical call ID format: digits followed by decimal point and more digits
    const altMatch = cleanBody.match(/(\d{10,}\.?\d*)/);
    if (altMatch) {
      console.log('Found call ID using fallback pattern:', altMatch[1]);
      idMatch = altMatch;
    }
  }

  if (!idMatch || !idMatch[1]) {
    console.log('No call ID found in email body. Clean body sample:', cleanBody.substring(0, 500));
    return null;
  }

  const service = serviceMatch?.[1]?.trim() || '';
  const callerNumber = callerMatch?.[1]?.trim() || '';
  const calledNumber = calledMatch?.[1]?.trim() || '';

  // Determine direction and extension based on patterns
  let direction: string | undefined;
  let extensionNumber: string | undefined;
  let finalCalledNumber = calledNumber;

  // Check if it's an outbound call (has "Numero Chiamato" field)
  if (calledMatch) {
    // Outbound call: our extension calls external number
    direction = 'outbound';
    // Numero Chiamante is the internal extension (short number)
    if (callerNumber.length <= 4 && /^\d+$/.test(callerNumber)) {
      extensionNumber = callerNumber;
    }
  } else if (service) {
    // Inbound call: no "Numero Chiamato" field, "Servizio" is our number
    direction = 'inbound';
    // For inbound: Numero Chiamante is the external caller, Servizio is our number
    finalCalledNumber = service; // The service number is what was called
  }

  // Normalize time format (replace dashes with colons if needed)
  let callTime = timeMatch?.[1]?.trim() || '';
  callTime = callTime.replace(/-/g, ':');

  // Normalize date format to YYYY-MM-DD
  let callDate = dateMatch?.[1]?.trim() || '';
  // Handle DD-MM-YYYY format
  const dateDashMatch = callDate.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (dateDashMatch) {
    callDate = `${dateDashMatch[3]}-${dateDashMatch[2]}-${dateDashMatch[1]}`;
  }
  // Handle DD/MM/YYYY format
  const dateSlashMatch = callDate.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (dateSlashMatch) {
    callDate = `${dateSlashMatch[3]}-${dateSlashMatch[2]}-${dateSlashMatch[1]}`;
  }

  console.log(`Parsed call: ID=${idMatch[1].trim()}, direction=${direction}, caller=${callerNumber}, called=${finalCalledNumber}, service=${service}`);

  return {
    caller_number: callerNumber,
    called_number: finalCalledNumber,
    service: service,
    call_date: callDate,
    call_time: callTime,
    duration_seconds: parseFloat(durationMatch?.[1] || '0'),
    unique_call_id: idMatch[1].trim(),
    extension_number: extensionNumber,
    direction: direction
  };
}

// Trigger AI analysis for a new call record
async function triggerAIAnalysis(callRecordId: string, callData: CallRecordData) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials for AI analysis trigger');
      return;
    }

    console.log(`Triggering AI analysis for call ${callRecordId}`);
    
    // Create a pseudo-transcription from the call data for AI to analyze
    const callInfo = `Chiamata ${callData.direction === 'inbound' ? 'in entrata' : 'in uscita'}
Da: ${callData.caller_number}
A: ${callData.called_number}
Servizio: ${callData.service}
Data: ${callData.call_date} ${callData.call_time}
Durata: ${callData.duration_seconds} secondi`;

    // Call the analyze-call-record function
    const analyzeUrl = `${supabaseUrl}/functions/v1/analyze-call-record`;
    
    const response = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        call_record_id: callRecordId,
        transcription_text: callInfo
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI analysis failed for call ${callRecordId}:`, response.status, errorText);
    } else {
      console.log(`AI analysis triggered successfully for call ${callRecordId}`);
    }
  } catch (error) {
    console.error(`Error triggering AI analysis for call ${callRecordId}:`, error);
  }
}
