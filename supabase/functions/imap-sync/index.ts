import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

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

interface FolderSyncState {
  uidvalidity: number;
  uidnext: number;
}

// Connect to IMAP server
async function connectToImap(config: ImapConfig): Promise<Deno.TcpConn | null> {
  try {
    const conn = await Deno.connect({
      hostname: config.host,
      port: config.port,
    });
    
    if (config.port === 993 || config.port === 465) {
      return await Deno.startTls(conn, { hostname: config.host });
    }
    
    return conn;
  } catch (error) {
    console.error('IMAP connection failed:', error);
    return null;
  }
}

// Send IMAP command
async function sendImapCommand(conn: Deno.TcpConn, command: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  await conn.write(encoder.encode(command + '\r\n'));
  
  const buffer = new Uint8Array(16384);
  let fullResponse = '';
  let totalBytes = 0;
  
  while (true) {
    const bytesRead = await conn.read(buffer);
    if (bytesRead === null) break;
    
    const chunk = decoder.decode(buffer.subarray(0, bytesRead));
    fullResponse += chunk;
    totalBytes += bytesRead;
    
    if (chunk.includes(' OK ') || chunk.includes(' NO ') || chunk.includes(' BAD ') || 
        totalBytes > 0 && bytesRead < buffer.length) {
      break;
    }
  }
  
  return fullResponse;
}

// Authenticate IMAP
async function authenticateImap(conn: Deno.TcpConn, user: string, pass: string): Promise<boolean> {
  try {
    const loginCommand = `A001 LOGIN ${user} ${pass}`;
    const response = await sendImapCommand(conn, loginCommand);
    return response.includes('A001 OK') || response.includes('LOGIN completed');
  } catch (error) {
    console.error('IMAP authentication failed:', error);
    return false;
  }
}

// Extract UIDVALIDITY and UIDNEXT from SELECT response
function extractFolderState(response: string): FolderSyncState | null {
  const uidvalidityMatch = response.match(/UIDVALIDITY (\d+)/);
  const uidnextMatch = response.match(/UIDNEXT (\d+)/);
  
  if (uidvalidityMatch && uidnextMatch) {
    return {
      uidvalidity: parseInt(uidvalidityMatch[1]),
      uidnext: parseInt(uidnextMatch[1])
    };
  }
  
  return null;
}

// Sync folder efficiently using UIDNEXT
async function syncFolder(
  conn: Deno.TcpConn,
  folder: string,
  userEmail: string,
  supabase: any,
  lastSyncState: FolderSyncState | null
): Promise<number> {
  console.log(`Syncing folder: ${folder}`);
  
  // SELECT folder
  const selectResponse = await sendImapCommand(conn, `A002 SELECT "${folder}"`);
  const currentState = extractFolderState(selectResponse);
  
  if (!currentState) {
    console.error('Failed to extract folder state');
    return 0;
  }
  
  // Check if UIDVALIDITY changed - if yes, full resync needed
  if (lastSyncState && lastSyncState.uidvalidity !== currentState.uidvalidity) {
    console.log('UIDVALIDITY changed, full resync required');
    // Delete old messages for this folder
    await supabase
      .from('mail_messages')
      .delete()
      .eq('user_email', userEmail)
      .eq('folder', folder);
    lastSyncState = null;
  }
  
  // Determine which UIDs to fetch
  let searchCriteria = 'ALL';
  if (lastSyncState && lastSyncState.uidnext) {
    // Only fetch new messages since last sync
    searchCriteria = `UID ${lastSyncState.uidnext}:*`;
  }
  
  // Search for messages
  const searchResponse = await sendImapCommand(conn, `A003 UID SEARCH ${searchCriteria}`);
  const uids = extractUIDs(searchResponse);
  
  if (uids.length === 0) {
    console.log('No new messages to sync');
    // Update sync state
    await supabase
      .from('mail_sync_state')
      .upsert({
        user_email: userEmail,
        folder: folder,
        uidvalidity: currentState.uidvalidity,
        uidnext: currentState.uidnext,
        last_sync_at: new Date().toISOString()
      }, {
        onConflict: 'user_email,folder'
      });
    return 0;
  }
  
  console.log(`Fetching ${uids.length} messages from ${folder}`);
  
  let syncedCount = 0;
  
  // Fetch only headers (envelope) for caching - bodies on demand
  for (const uid of uids) {
    try {
      const fetchResponse = await sendImapCommand(
        conn, 
        `A004 UID FETCH ${uid} (FLAGS ENVELOPE BODYSTRUCTURE)`
      );
      
      const message = parseMessageEnvelope(fetchResponse, uid, folder, userEmail);
      
      if (message) {
        // Upsert message to cache
        await supabase
          .from('mail_messages')
          .upsert(message, {
            onConflict: 'user_email,folder,uid'
          });
        
        syncedCount++;
      }
    } catch (error) {
      console.error(`Failed to fetch UID ${uid}:`, error);
    }
  }
  
  // Update sync state
  await supabase
    .from('mail_sync_state')
    .upsert({
      user_email: userEmail,
      folder: folder,
      uidvalidity: currentState.uidvalidity,
      uidnext: currentState.uidnext,
      last_sync_at: new Date().toISOString()
    }, {
      onConflict: 'user_email,folder'
    });
  
  console.log(`Synced ${syncedCount} messages from ${folder}`);
  return syncedCount;
}

// Extract UIDs from SEARCH response
function extractUIDs(response: string): number[] {
  const searchMatch = response.match(/\* SEARCH (.+)/);
  if (!searchMatch) return [];
  
  return searchMatch[1]
    .trim()
    .split(' ')
    .map(uid => parseInt(uid))
    .filter(uid => !isNaN(uid));
}

// Parse message envelope (headers only)
function parseMessageEnvelope(response: string, uid: number, folder: string, userEmail: string): any | null {
  try {
    const lines = response.split('\n');
    let flags: string[] = [];
    let subject = '';
    let from = '';
    let to = '';
    let date = new Date().toISOString();
    let hasAttachments = false;
    
    for (const line of lines) {
      // Extract FLAGS
      if (line.includes('FLAGS')) {
        const flagsMatch = line.match(/FLAGS \(([^)]*)\)/);
        if (flagsMatch) {
          flags = flagsMatch[1].split(' ').filter(f => f);
        }
      }
      
      // Check for attachments in BODYSTRUCTURE
      if (line.includes('BODYSTRUCTURE') && line.includes('attachment')) {
        hasAttachments = true;
      }
      
      // Parse subject
      if (line.includes('Subject:')) {
        subject = line.replace('Subject:', '').trim();
      }
      
      // Parse from
      if (line.includes('From:')) {
        from = line.replace('From:', '').trim();
      }
      
      // Parse to
      if (line.includes('To:')) {
        to = line.replace('To:', '').trim();
      }
      
      // Parse date
      if (line.includes('Date:')) {
        const dateStr = line.replace('Date:', '').trim();
        try {
          date = new Date(dateStr).toISOString();
        } catch {
          // Keep current date
        }
      }
    }
    
    // Create snippet from subject
    const snippet = subject.substring(0, 150);
    
    return {
      user_email: userEmail,
      uid: uid,
      folder: folder,
      subject: subject || '(No Subject)',
      from_address: from || 'Unknown',
      to_address: to || userEmail,
      date: date,
      flags: flags,
      snippet: snippet,
      has_attachments: hasAttachments,
      synced_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Failed to parse envelope:', error);
    return null;
  }
}

// List all folders
async function listFolders(conn: Deno.TcpConn): Promise<string[]> {
  const response = await sendImapCommand(conn, 'A005 LIST "" "*"');
  const folders: string[] = [];
  
  const lines = response.split('\n');
  for (const line of lines) {
    const match = line.match(/\* LIST \([^)]*\) "[^"]*" "?([^"]+)"?/);
    if (match) {
      folders.push(match[1]);
    }
  }
  
  return folders;
}

// Main handler
const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imap_config, user_email, sync_folders } = await req.json();
    
    if (!imap_config || !user_email) {
      return new Response(JSON.stringify({ error: 'Missing configuration' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Connect to IMAP
    const conn = await connectToImap(imap_config);
    if (!conn) {
      throw new Error('Failed to connect to IMAP server');
    }
    
    try {
      // Read greeting
      await sendImapCommand(conn, '');
      
      // Authenticate
      const authenticated = await authenticateImap(conn, imap_config.user, imap_config.pass);
      if (!authenticated) {
        throw new Error('IMAP authentication failed');
      }
      
      // Get folders to sync
      let folders = sync_folders || ['INBOX', 'Sent', 'Drafts', 'Trash'];
      
      // If sync_folders is 'all', list all folders
      if (sync_folders === 'all') {
        folders = await listFolders(conn);
      }
      
      let totalSynced = 0;
      const results: any[] = [];
      
      // Sync each folder
      for (const folder of folders) {
        try {
          // Get last sync state
          const { data: syncState } = await supabase
            .from('mail_sync_state')
            .select('*')
            .eq('user_email', user_email)
            .eq('folder', folder)
            .single();
          
          const synced = await syncFolder(
            conn,
            folder,
            user_email,
            supabase,
            syncState || null
          );
          
          totalSynced += synced;
          results.push({
            folder,
            synced,
            status: 'success'
          });
        } catch (error: any) {
          console.error(`Failed to sync folder ${folder}:`, error);
          results.push({
            folder,
            synced: 0,
            status: 'error',
            error: error.message
          });
        }
      }
      
      await sendImapCommand(conn, 'A099 LOGOUT');
      
      return new Response(JSON.stringify({
        success: true,
        total_synced: totalSynced,
        folders: results
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } finally {
      try {
        conn.close();
      } catch (e) {
        console.error('Error closing connection:', e);
      }
    }
    
  } catch (error: any) {
    console.error('Error in imap-sync:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

serve(handler);
