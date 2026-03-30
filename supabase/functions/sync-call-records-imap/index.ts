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

interface EmailParseResult {
  body: string;
  mp3Attachment?: {
    filename: string;
    data: Uint8Array;
  };
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
          let { data: existing } = await supabase
            .from('call_records')
            .select('id, duration_seconds, recording_url, call_time, unique_call_id, transcription')
            .eq('unique_call_id', callData.unique_call_id)
            .single();

          // Secondary match: same call signature even if unique_call_id is corrupted/different
          if (!existing) {
            existing = await findExistingCallBySignature(supabase, callData);
            if (existing) {
              console.log(`Matched existing record by signature: ${existing.id} (existing ID: ${existing.unique_call_id}, incoming ID: ${callData.unique_call_id})`);
            }
          }

          const hasValidTranscription = existing?.transcription && existing.transcription.length > 20;
          const shouldRefreshRecording = !!existing && !hasValidTranscription && !!emailData.mp3Attachment && callData.duration_seconds > 0 &&
            (!existing.recording_url || !existing.recording_url.includes(callData.unique_call_id));

          // If record exists and we have better data, update duration and/or recording
          if (existing && (callData.duration_seconds > (existing.duration_seconds || 0) || shouldRefreshRecording)) {
            console.log(`Updating existing record ${existing.id}: duration ${existing.duration_seconds} -> ${callData.duration_seconds}`);
            
            // Upload newer MP3 if present
            let updatedRecordingUrl: string | null = null;
            if (emailData.mp3Attachment) {
              const storagePath = `${callData.call_date}/${callData.unique_call_id}_updated.mp3`;
              const { error: uploadError } = await supabase.storage
                .from('call-recordings')
                .upload(storagePath, emailData.mp3Attachment.data, {
                  contentType: 'audio/mpeg',
                  upsert: true
                });
              if (!uploadError) {
                const { data: urlData } = supabase.storage
                  .from('call-recordings')
                  .getPublicUrl(storagePath);
                updatedRecordingUrl = urlData?.publicUrl || storagePath;
              }
            }

            const updateData: any = {
              duration_seconds: Math.max(callData.duration_seconds, existing.duration_seconds || 0),
              call_time: callData.call_time,
            };

            if (updatedRecordingUrl) {
              updateData.recording_url = updatedRecordingUrl;
              // Force re-processing on refreshed audio
              updateData.transcription = null;
              updateData.ai_summary = null;
              updateData.ai_sentiment = null;
              updateData.ai_actions = [];
              updateData.ai_processed_at = null;
            }

            await supabase
              .from('call_records')
              .update(updateData)
              .eq('id', existing.id);

            // Retrigger transcription if we uploaded a refreshed recording
            if (updatedRecordingUrl) {
              await triggerTranscription(existing.id, updatedRecordingUrl);
            }
            
            newCallRecords++;
          }

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
            let leadMatch = await findLeadByPhone(supabase, callData.caller_number, callData.direction);

            // If no lead found, create a new one automatically
            if (!leadMatch) {
              const customerPhone = callData.direction === 'in' ? callData.caller_number : callData.called_number;
              const newLead = await createLeadFromCall(supabase, customerPhone);
              if (newLead) {
                leadMatch = { id: newLead.id, matched_by: 'auto_created' };
                console.log(`Created new lead from call: ${newLead.id}`);
              }
            }

            // Upload MP3 to storage if present
            let recordingUrl: string | null = null;
            if (emailData.mp3Attachment) {
              const storagePath = `${callData.call_date}/${callData.unique_call_id}.mp3`;
              const { error: uploadError } = await supabase.storage
                .from('call-recordings')
                .upload(storagePath, emailData.mp3Attachment.data, {
                  contentType: 'audio/mpeg',
                  upsert: true
                });

              if (uploadError) {
                console.error('Failed to upload MP3:', uploadError);
              } else {
                // Get public URL
                const { data: urlData } = supabase.storage
                  .from('call-recordings')
                  .getPublicUrl(storagePath);
                recordingUrl = urlData?.publicUrl || storagePath;
                console.log(`Uploaded recording: ${recordingUrl}`);
              }
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
                lead_id: leadMatch?.id || null,
                matched_by: leadMatch?.matched_by || null,
                recording_url: recordingUrl
              });

            if (!insertError) {
              newCallRecords++;
              
              // Get the inserted record ID
              const { data: insertedRecord } = await supabase
                .from('call_records')
                .select('id')
                .eq('unique_call_id', callData.unique_call_id)
                .single();
              
              if (insertedRecord) {
                // If we have a recording, trigger transcription first
                if (recordingUrl) {
                  await triggerTranscription(insertedRecord.id, recordingUrl);
                } else {
                  // No recording - trigger AI analysis with basic call info
                  triggerAIAnalysis(insertedRecord.id, callData);
                }
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
  // Use SINCE to search emails from last 2 days for better coverage without overload
  const today = new Date();
  const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dateStr = `${twoDaysAgo.getDate()}-${months[twoDaysAgo.getMonth()]}-${twoDaysAgo.getFullYear()}`;
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

    console.log(`Legacy config ${config.name}: found ${messageIds.length} messages in last 2 days`);

    // Process ALL messages (dedup logic handles already-imported records efficiently)
    const messagesToProcess = messageIds;

    let processedCount = 0;
    let newCallRecords = 0;

    for (const msgId of messagesToProcess) {
      try {
        // STEP 1: Lightweight fetch - text only (no MP3 attachment download)
        const headerResponse = await sendCommand(conn, `FETCH ${msgId} (BODY.PEEK[1])`);
        let emailBody = '';
        
        // Try to extract text from BODY[1] response
        const bodyMatch = headerResponse.match(/\{(\d+)\}\r?\n([\s\S]*)/);
        if (bodyMatch) {
          emailBody = bodyMatch[2].substring(0, parseInt(bodyMatch[1]));
        } else {
          emailBody = headerResponse;
        }
        
        const callData = extractCallRecordData(emailBody);

        if (!callData) {
          // Fallback: try full fetch if BODY[1] didn't work
          const fullResponse = await sendCommand(conn, `FETCH ${msgId} (BODY.PEEK[])`);
          const fullEmailData = parseEmailBody(fullResponse);
          const fallbackCallData = extractCallRecordData(fullEmailData.body);
          if (!fallbackCallData) continue;
          
          // Process with full data (including potential MP3)
          await processCallRecord(supabase, fallbackCallData, fullEmailData, null);
          processedCount++;
          newCallRecords++;
          continue;
        }

        // STEP 2: Check if record already exists (fast DB lookup)
        let { data: existing } = await supabase
          .from('call_records')
          .select('id, duration_seconds, recording_url, call_time, unique_call_id, transcription')
          .eq('unique_call_id', callData.unique_call_id)
          .single();

        if (!existing) {
          existing = await findExistingCallBySignature(supabase, callData);
          if (existing) {
            console.log(`(Legacy) matched existing record by signature: ${existing.id}`);
          }
        }

        const hasValidTranscription = existing?.transcription && existing.transcription.length > 20;

        // STEP 3: If record exists with valid transcription and adequate duration, SKIP entirely
        if (existing && hasValidTranscription && callData.duration_seconds <= (existing.duration_seconds || 0)) {
          processedCount++;
          continue; // No need to download MP3
        }

        // STEP 4: Only now fetch full email with MP3 attachment for new/updated records
        const fullEmailResponse = await sendCommand(conn, `FETCH ${msgId} (BODY.PEEK[])`);
        const emailData = parseEmailBody(fullEmailResponse);

        if (existing) {
          // Update existing record if needed
          const shouldRefreshRecording = !hasValidTranscription && !!emailData.mp3Attachment && callData.duration_seconds > 0 &&
            (!existing.recording_url || !existing.recording_url.includes(callData.unique_call_id));

          if (callData.duration_seconds > (existing.duration_seconds || 0) || shouldRefreshRecording) {
            console.log(`Updating existing record ${existing.id}: duration ${existing.duration_seconds} -> ${callData.duration_seconds}`);
            
            let updatedRecordingUrl: string | null = null;
            if (emailData.mp3Attachment) {
              const storagePath = `${callData.call_date}/${callData.unique_call_id}_updated.mp3`;
              const { error: uploadError } = await supabase.storage
                .from('call-recordings')
                .upload(storagePath, emailData.mp3Attachment.data, {
                  contentType: 'audio/mpeg',
                  upsert: true
                });
              if (!uploadError) {
                const { data: urlData } = supabase.storage
                  .from('call-recordings')
                  .getPublicUrl(storagePath);
                updatedRecordingUrl = urlData?.publicUrl || storagePath;
              }
            }

            const updateData: any = {
              duration_seconds: Math.max(callData.duration_seconds, existing.duration_seconds || 0),
              call_time: callData.call_time,
            };

            if (updatedRecordingUrl) {
              updateData.recording_url = updatedRecordingUrl;
              updateData.transcription = null;
              updateData.ai_summary = null;
              updateData.ai_sentiment = null;
              updateData.ai_actions = [];
              updateData.ai_processed_at = null;
            }

            await supabase
              .from('call_records')
              .update(updateData)
              .eq('id', existing.id);

            if (updatedRecordingUrl) {
              await triggerTranscription(existing.id, updatedRecordingUrl);
            }
            
            newCallRecords++;
          }
        } else {
          // NEW record - insert it
          let leadMatch = await findLeadByPhone(supabase, callData.caller_number, callData.direction);
          
          if (!leadMatch) {
            const customerPhone = callData.direction === 'in' ? callData.caller_number : callData.called_number;
            const newLead = await createLeadFromCall(supabase, customerPhone);
            if (newLead) {
              leadMatch = { id: newLead.id, matched_by: 'auto_created' };
              console.log(`Created new lead from call: ${newLead.id}`);
            }
          }

          let recordingUrl: string | null = null;
          if (emailData.mp3Attachment) {
            const storagePath = `${callData.call_date}/${callData.unique_call_id}.mp3`;
            const { error: uploadError } = await supabase.storage
              .from('call-recordings')
              .upload(storagePath, emailData.mp3Attachment.data, {
                contentType: 'audio/mpeg',
                upsert: true
              });

            if (uploadError) {
              console.error('Failed to upload MP3:', uploadError);
            } else {
              const { data: urlData } = supabase.storage
                .from('call-recordings')
                .getPublicUrl(storagePath);
              recordingUrl = urlData?.publicUrl || storagePath;
              console.log(`Uploaded recording: ${recordingUrl}`);
            }
          }

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
              matched_by: leadMatch?.matched_by || null,
              recording_url: recordingUrl
            });

          if (!insertError) {
            newCallRecords++;
            
            const { data: insertedRecord } = await supabase
              .from('call_records')
              .select('id')
              .eq('unique_call_id', callData.unique_call_id)
              .single();
            
            if (insertedRecord) {
              if (recordingUrl) {
                await triggerTranscription(insertedRecord.id, recordingUrl);
              } else {
                triggerAIAnalysis(insertedRecord.id, callData);
              }
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

// Normalizza numero rimuovendo TUTTI i caratteri non numerici (inclusi Unicode invisibili)
function normalizeItalianPhone(phone: string): string {
  if (!phone) return '';
  let normalized = phone.replace(/[^\d]/g, '');
  if (normalized.startsWith('0039')) {
    normalized = normalized.slice(4);
  } else if (normalized.startsWith('39') && normalized.length > 10) {
    normalized = normalized.slice(2);
  }
  return normalized;
}

// Find lead by phone number - normalizes and searches with Italian phone handling
// Uses multiple strategies: RPC normalized search, then ilike fallback
async function findLeadByPhone(supabase: any, phoneNumber: string, direction?: string): Promise<{ id: string; matched_by: string } | null> {
  if (!phoneNumber || phoneNumber.length < 6) return null;
  
  const normalized = normalizeItalianPhone(phoneNumber);
  if (normalized.length < 6) return null;

  // Strategy 1: Use RPC for normalized digit matching (most reliable)
  const rpcPatterns = [
    normalized.length >= 9 ? normalized.slice(-9) : null,
    normalized.slice(-8),
    normalized.slice(-7),
  ].filter(Boolean) as string[];

  for (const pattern of rpcPatterns) {
    try {
      const { data: candidates } = await supabase.rpc(
        'find_lead_by_normalized_phone',
        { search_pattern: pattern }
      );
      if (candidates && candidates.length > 0) {
        // Prefer best match: compare last 8 digits
        const targetLast8 = normalized.slice(-8);
        const best = candidates.find((c: any) => {
          const cDigits = (c.phone || '').replace(/\D/g, '');
          return cDigits.slice(-8) === targetLast8;
        }) || candidates[0];
        console.log(`Found lead ${best.id} via RPC pattern: ${pattern}`);
        return { id: best.id, matched_by: 'phone' };
      }
    } catch (e) {
      console.log(`RPC search failed for pattern ${pattern}, falling back to ilike`);
    }
  }

  // Strategy 2: Fallback ilike search (handles edge cases)
  const ilikePatterns = [normalized, normalized.slice(-8), normalized.slice(-7), normalized.slice(-6)];
  for (const pattern of ilikePatterns) {
    if (!pattern || pattern.length < 6) continue;
    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .filter('phone', 'ilike', `%${pattern}%`)
      .limit(1)
      .single();
    if (lead) {
      console.log(`Found lead ${lead.id} via ilike pattern: ${pattern}`);
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
  
  const tag = 'A' + Math.floor(Math.random() * 10000);
  await conn.write(encoder.encode(`${tag} ${command}\r\n`));
  
  return await readResponse(conn, tag);
}

async function readResponse(conn: Deno.TcpConn, tag?: string): Promise<string> {
  const decoder = new TextDecoder();
  const buffer = new Uint8Array(65536);
  let fullResponse = '';
  const maxBytes = 10 * 1024 * 1024; // 10MB safety limit
  
  while (fullResponse.length < maxBytes) {
    const bytesRead = await conn.read(buffer);
    if (bytesRead === null) break;
    
    const chunk = decoder.decode(buffer.subarray(0, bytesRead));
    fullResponse += chunk;
    
    // Check for IMAP tagged response completion (must be at start of a line)
    // e.g., "A1234 OK FETCH completed" or "A1234 NO ..." or "A1234 BAD ..."
    if (tag) {
      // Check only the last portion for the tag to avoid false positives in binary data
      const tail = fullResponse.slice(-Math.min(fullResponse.length, 500));
      if (tail.includes(`${tag} OK`) || tail.includes(`${tag} NO`) || tail.includes(`${tag} BAD`)) {
        break;
      }
    } else {
      // No tag (greeting) - check for any OK/NO/BAD or server greeting
      if (chunk.includes('* OK') || chunk.includes(' OK ') || chunk.includes(' NO ') || chunk.includes(' BAD ')) {
        break;
      }
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

function parseEmailBody(response: string): EmailParseResult {
  let result: EmailParseResult = { body: '' };
  let mp3Attachment: { filename: string; data: Uint8Array } | undefined;

  // Look for MP3 attachment in the email
  const boundaryMatch = response.match(/boundary="?([^"\r\n]+)"?/i);
  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = response.split('--' + boundary);
    
    for (const part of parts) {
      // Check for MP3 attachment
      const isAudioPart = part.toLowerCase().includes('audio/mpeg') || 
                          part.toLowerCase().includes('audio/mp3') ||
                          part.toLowerCase().includes('.mp3');
      
      if (isAudioPart) {
        // Extract filename
        const filenameMatch = part.match(/filename="?([^"\r\n]+\.mp3)"?/i) ||
                             part.match(/name="?([^"\r\n]+\.mp3)"?/i);
        const filename = filenameMatch?.[1] || 'recording.mp3';
        
        // Check if base64 encoded
        const isBase64 = part.toLowerCase().includes('content-transfer-encoding: base64');
        
        if (isBase64) {
          // Find content after headers (double newline)
          const contentStart = part.search(/\r?\n\r?\n/);
          if (contentStart > -1) {
            let base64Content = part.substring(contentStart).trim();
            // Remove trailing boundary marker and whitespace
            base64Content = base64Content.split('--')[0].replace(/\s/g, '');
            
            try {
              // Decode base64 to binary
              const binaryString = atob(base64Content);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              mp3Attachment = { filename, data: bytes };
              console.log(`Found MP3 attachment: ${filename}, size: ${bytes.length} bytes`);
            } catch (e) {
              console.error('Failed to decode MP3 base64:', e);
            }
          }
        }
      }
      
      // Find text/plain part for call data
      if (part.includes('Content-Type: text/plain') || part.includes('content-type: text/plain')) {
        const isBase64 = part.toLowerCase().includes('content-transfer-encoding: base64');
        const isQP = part.toLowerCase().includes('content-transfer-encoding: quoted-printable');
        
        const contentStart = part.search(/\r?\n\r?\n/);
        if (contentStart > -1) {
          let content = part.substring(contentStart).trim();
          content = content.split('--')[0].trim();
          
          if (isBase64) {
            try {
              content = atob(content.replace(/\s/g, ''));
            } catch (e) {
              console.log('Base64 decode failed for text part');
            }
          } else if (isQP) {
            content = decodeQuotedPrintable(content);
          }
          
          result.body = content;
        }
      }
    }
  }
  
  // If no body found in parts, try pattern matching on raw response
  if (!result.body) {
    // Pattern 1: Outbound calls with "ID Univoco Chiamata"
    const outboundMatch = response.match(/Numero Chiamante:\s*[^\r\n]+[\s\S]*?ID Univoco Chiamata:\s*[^\r\n]+/i);
    if (outboundMatch) {
      result.body = outboundMatch[0];
    } else {
      // Pattern 2: Inbound calls with "ID Chiamata"
      const inboundMatch = response.match(/Numero Chiamante:\s*[^\r\n]+[\s\S]*?ID Chiamata:\s*[^\r\n]+/i);
      if (inboundMatch) {
        result.body = inboundMatch[0];
      } else {
        result.body = response;
      }
    }
  }
  
  if (mp3Attachment) {
    result.mp3Attachment = mp3Attachment;
  }
  
  return result;
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
    const altMatch = cleanBody.match(/(\d{10,}\.\d+)/);
    if (altMatch) {
      console.log('Found call ID using fallback pattern:', altMatch[1]);
      idMatch = altMatch;
    } else {
      // Last resort: generate a composite ID from caller+called+date+time to avoid collisions
      const fallbackCaller = callerMatch?.[1]?.trim() || '';
      const fallbackCalled = calledMatch?.[1]?.trim() || '';
      const fallbackDate = dateMatch?.[1]?.trim() || '';
      const fallbackTime = timeMatch?.[1]?.trim() || '';
      if (fallbackCaller && fallbackDate && fallbackTime) {
        const compositeId = `${fallbackCaller}-${fallbackCalled}-${fallbackDate}-${fallbackTime}`.replace(/[^a-zA-Z0-9\-]/g, '');
        console.log('Generated composite fallback call ID:', compositeId);
        idMatch = [compositeId, compositeId];
      }
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

async function findExistingCallBySignature(supabase: any, callData: CallRecordData) {
  try {
    let query = supabase
      .from('call_records')
      .select('id, duration_seconds, recording_url, call_time, unique_call_id, transcription')
      .eq('call_date', callData.call_date)
      .eq('caller_number', callData.caller_number)
      .eq('called_number', callData.called_number)
      .order('created_at', { ascending: false })
      .limit(20);

    if (callData.direction) {
      query = query.eq('direction', callData.direction);
    }

    const { data: candidates, error } = await query;
    if (error || !candidates || candidates.length === 0) return null;

    const toSeconds = (time: string | null | undefined) => {
      if (!time) return null;
      const [h, m, s] = time.split(':').map((v) => Number(v));
      if ([h, m, s].some((v) => Number.isNaN(v))) return null;
      return h * 3600 + m * 60 + s;
    };

    const targetSeconds = toSeconds(callData.call_time);
    if (targetSeconds === null) return candidates[0];

    const withinWindow = candidates
      .map((candidate: any) => {
        const candidateSeconds = toSeconds(candidate.call_time);
        const delta = candidateSeconds === null ? Number.MAX_SAFE_INTEGER : Math.abs(candidateSeconds - targetSeconds);
        return { candidate, delta };
      })
      .filter((item: any) => item.delta <= 180)
      .sort((a: any, b: any) => {
        if (a.delta !== b.delta) return a.delta - b.delta;
        return (a.candidate.duration_seconds || 0) - (b.candidate.duration_seconds || 0);
      });

    return withinWindow.length > 0 ? withinWindow[0].candidate : null;
  } catch (error) {
    console.error('Error in findExistingCallBySignature:', error);
    return null;
  }
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

// Trigger audio transcription for a call with recording
async function triggerTranscription(callRecordId: string, recordingUrl: string) {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase credentials for transcription trigger');
      return;
    }

    console.log(`Triggering transcription for call ${callRecordId}`);
    
    const transcribeUrl = `${supabaseUrl}/functions/v1/transcribe-call-audio`;
    
    // Fire and forget - don't wait for transcription to complete
    fetch(transcribeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        call_record_id: callRecordId,
        recording_url: recordingUrl
      })
    }).then(response => {
      if (!response.ok) {
        console.error(`Transcription trigger failed for call ${callRecordId}:`, response.status);
      } else {
        console.log(`Transcription triggered successfully for call ${callRecordId}`);
      }
    }).catch(error => {
      console.error(`Error triggering transcription for call ${callRecordId}:`, error);
    });
  } catch (error) {
    console.error(`Error in triggerTranscription for call ${callRecordId}:`, error);
  }
}

// Create a new lead from call when no match is found
async function createLeadFromCall(supabase: any, phoneNumber: string): Promise<{ id: string } | null> {
  try {
    // Check if there's already a lead with this phone number to avoid duplicates
    const normalizedPhone = normalizeItalianPhone(phoneNumber);
    
    if (!normalizedPhone || normalizedPhone.length < 6) {
      console.log('Phone number too short to create lead:', phoneNumber);
      return null;
    }

    // Search with multiple patterns to catch all variations
    // Include both the original phone and normalized version
    const searchPatterns = [
      phoneNumber, // Original format (e.g., +393802375325)
      normalizedPhone, // Normalized (e.g., 3802375325)
      normalizedPhone.slice(-8), // Last 8 digits
      normalizedPhone.slice(-6), // Last 6 digits
    ];

    for (const pattern of searchPatterns) {
      if (!pattern || pattern.length < 6) continue;
      
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id')
        .filter('phone', 'ilike', `%${pattern}%`)
        .limit(1)
        .single();

      if (existingLead) {
        console.log('Lead already exists with this phone pattern:', pattern, existingLead.id);
        return existingLead;
      }
    }

    // Genera codice random per identificare il lead
    const randomCode = `CALL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const callDate = new Date().toLocaleDateString('it-IT');
    const callTime = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

    // Create new lead with status "nuovo" and pre_qualificato = true
    const { data: newLead, error } = await supabase
      .from('leads')
      .insert({
        contact_name: 'Lead da chiamata',
        company_name: 'Da identificare',
        phone: phoneNumber,
        status: 'new',
        source: 'phone_call',
        pre_qualificato: true,
        pipeline: 'Zapper',
        notes: `Lead creato automaticamente da chiamata telefonica.\nCodice: ${randomCode}\nData: ${callDate} ore ${callTime}\nNumero: ${phoneNumber}`
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating lead from call:', error);
      return null;
    }

    console.log(`Created new lead ${newLead.id} for phone ${phoneNumber}`);
    return newLead;
  } catch (error) {
    console.error('Error in createLeadFromCall:', error);
    return null;
  }
}
