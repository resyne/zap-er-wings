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

    console.log('Starting IMAP sync for call records...');

    // Get active IMAP configuration
    const { data: configs, error: configError } = await supabase
      .from('imap_config')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    if (configError || !configs || configs.length === 0) {
      console.log('No active IMAP configuration found');
      return new Response(
        JSON.stringify({ error: 'No active IMAP configuration found. Please configure IMAP settings first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = configs[0];
    console.log(`Using IMAP config: ${config.name} (${config.host}:${config.port})`);

    // Connect to IMAP server
    const imapConfig: ImapConfig = {
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password_encrypted, // In production, decrypt this
      folder: config.folder || 'INBOX'
    };

    // Connect and authenticate
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
      
      // Get sync state to know which emails we've already processed
      const { data: syncState } = await supabase
        .from('imap_sync_state')
        .select('*')
        .eq('config_id', config.id)
        .single();

      // Search for unread emails (or all emails if first sync)
      const searchCriteria = config.search_criteria || 'UNSEEN';
      console.log(`Search criteria: ${searchCriteria}`);
      const searchResponse = await sendCommand(conn, `SEARCH ${searchCriteria}`);
      console.log(`Search response: ${searchResponse}`);
      const messageIds = extractMessageIds(searchResponse);

      console.log(`Found ${messageIds.length} messages to process`);

      // Limit to 50 messages per sync to avoid timeout
      const MAX_MESSAGES_PER_SYNC = 50;
      const messagesToProcess = messageIds.slice(0, MAX_MESSAGES_PER_SYNC);
      
      if (messageIds.length > MAX_MESSAGES_PER_SYNC) {
        console.log(`Processing only first ${MAX_MESSAGES_PER_SYNC} messages to avoid timeout`);
      }

      let processedCount = 0;
      let newCallRecords = 0;

      for (const msgId of messagesToProcess) {
        try {
          // Fetch email content
          const emailResponse = await sendCommand(conn, `FETCH ${msgId} (BODY.PEEK[])`);
          const emailData = parseEmailBody(emailResponse);

          // Extract call record data
          const callData = extractCallRecordData(emailData.body);

          if (callData) {
            console.log(`Processing call record: ${callData.unique_call_id}`);

            // Check if call record already exists
            const { data: existing } = await supabase
              .from('call_records')
              .select('id')
              .eq('unique_call_id', callData.unique_call_id)
              .single();

            if (!existing) {
              // Insert new call record
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
                  recording_url: null // TODO: Handle MP3 attachments
                });

              if (insertError) {
                console.error('Error inserting call record:', insertError);
              } else {
                newCallRecords++;
                console.log(`Created call record: ${callData.unique_call_id}`);
              }
            }

            processedCount++;
          }
        } catch (error) {
          console.error(`Error processing message ${msgId}:`, error);
        }
      }

      // Update sync state
      await supabase
        .from('imap_sync_state')
        .upsert({
          config_id: config.id,
          last_sync_at: new Date().toISOString(),
          emails_processed: (syncState?.emails_processed || 0) + processedCount
        }, {
          onConflict: 'config_id'
        });

      // Update config last_sync_at
      await supabase
        .from('imap_config')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', config.id);

      // Logout
      await sendCommand(conn, 'LOGOUT');

      console.log(`Sync complete: ${processedCount} emails processed, ${newCallRecords} new call records created`);

      return new Response(
        JSON.stringify({
          success: true,
          emails_processed: processedCount,
          new_call_records: newCallRecords,
          total_found: messageIds.length,
          config_name: config.name
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } finally {
      try {
        conn.close();
      } catch (e) {
        console.error('Error closing connection:', e);
      }
    }

  } catch (error) {
    console.error('Error in IMAP sync:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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
  const decoder = new TextDecoder();
  
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
  // Extract email body from IMAP FETCH response
  // This is a simplified version
  const bodyMatch = response.match(/\{(\d+)\}\r\n([\s\S]+)/);
  if (bodyMatch) {
    return { body: bodyMatch[2] };
  }
  return { body: response };
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
    return null;
  }

  return {
    caller_number: callerMatch?.[1]?.trim() || '',
    called_number: calledMatch?.[1]?.trim() || '',
    service: serviceMatch?.[1]?.trim() || '',
    call_date: dateMatch?.[1]?.trim() || '',
    call_time: timeMatch?.[1]?.trim() || '',
    duration_seconds: parseFloat(durationMatch?.[1] || '0'),
    unique_call_id: idMatch[1].trim()
  };
}
