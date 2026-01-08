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
    
    // Search for unread emails
    const searchCriteria = pbx.imap_search_criteria || 'UNSEEN';
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
                recording_url: null
              });

            if (!insertError) {
              newCallRecords++;
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
  // Use the configured search criteria - default to UNSEEN if not set
  const searchCriteria = config.search_criteria || 'UNSEEN';
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
                direction: callData.direction
              });

            if (!insertError) newCallRecords++;
          }
          processedCount++;
        }
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
  // First, try to find the call data pattern directly anywhere in the email
  // This is the most reliable approach since the format is consistent
  const callDataMatch = response.match(/Numero Chiamante:\s*[^\r\n]+[\s\S]*?ID Univoco Chiamata:\s*[^\r\n]+/i);
  if (callDataMatch) {
    console.log('Found call data pattern directly');
    return { body: callDataMatch[0] };
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
  const callerMatch = emailBody.match(/Numero Chiamante:\s*(.+)/i);
  const calledMatch = emailBody.match(/Numero Chiamato:\s*(.+)/i);
  const serviceMatch = emailBody.match(/Servizio:\s*(.+)/i);
  const dateMatch = emailBody.match(/Data:\s*(.+)/i);
  const timeMatch = emailBody.match(/Ora:\s*(.+)/i);
  const durationMatch = emailBody.match(/Durata:\s*([\d.]+)\s*Secondi/i);
  const idMatch = emailBody.match(/ID Univoco Chiamata:\s*(.+)/i);

  if (!idMatch) {
    console.log('No ID Univoco Chiamata found in email');
    return null;
  }

  const service = serviceMatch?.[1]?.trim() || '';
  const callerNumber = callerMatch?.[1]?.trim() || '';
  const calledNumber = calledMatch?.[1]?.trim() || '';

  // Determine direction and extension based on service type
  let direction: string | undefined;
  let extensionNumber: string | undefined;

  if (service.toLowerCase().includes('chiamate_out') || service.toLowerCase().includes('out')) {
    // Outbound call: interno is the caller (Numero Chiamante)
    direction = 'outbound';
    // If caller is a short number (likely internal extension)
    if (callerNumber.length <= 4 && /^\d+$/.test(callerNumber)) {
      extensionNumber = callerNumber;
    }
  } else if (service.toLowerCase().includes('in') || service.toLowerCase().includes('ricevut')) {
    // Inbound call: interno is the called party (Numero Chiamato) if it's short
    direction = 'inbound';
    // If called number is a short number (likely internal extension)
    if (calledNumber.length <= 4 && /^\d+$/.test(calledNumber)) {
      extensionNumber = calledNumber;
    }
  }

  // Normalize time format (replace dashes with colons if needed)
  let callTime = timeMatch?.[1]?.trim() || '';
  callTime = callTime.replace(/-/g, ':');

  // Normalize date format (DD-MM-YYYY to YYYY-MM-DD if needed)
  let callDate = dateMatch?.[1]?.trim() || '';
  const datePartsMatch = callDate.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (datePartsMatch) {
    callDate = `${datePartsMatch[3]}-${datePartsMatch[2]}-${datePartsMatch[1]}`;
  }

  console.log(`Parsed call: ID=${idMatch[1].trim()}, direction=${direction}, extension=${extensionNumber}, service=${service}`);

  return {
    caller_number: callerNumber,
    called_number: calledNumber,
    service: service,
    call_date: callDate,
    call_time: callTime,
    duration_seconds: parseFloat(durationMatch?.[1] || '0'),
    unique_call_id: idMatch[1].trim(),
    extension_number: extensionNumber,
    direction: direction
  };
}
