import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailAccount {
  id: string;
  user_id: string;
  email: string;
  imap_config: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };
  last_sync: string | null;
  active: boolean;
}

interface Email {
  id: string;
  account_id: string;
  message_id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  read: boolean;
  starred: boolean;
  hasAttachments: boolean;
  folder: string;
}

// Real IMAP connection using TCP socket
async function connectToImap(config: any): Promise<Deno.TcpConn | null> {
  try {
    console.log(`Connecting to IMAP server: ${config.host} port: ${config.port}`);
    const conn = await Deno.connect({
      hostname: config.host,
      port: config.port,
    });
    
    // Use TLS only for secure ports (993, 465)
    if (config.port === 993 || config.port === 465) {
      return await Deno.startTls(conn, { hostname: config.host });
    }
    
    return conn;
  } catch (error) {
    console.error('IMAP connection failed:', error);
    return null;
  }
}

async function sendImapCommand(conn: Deno.TcpConn, command: string): Promise<string> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  await conn.write(encoder.encode(command + '\r\n'));
  
  const buffer = new Uint8Array(8192);
  const bytesRead = await conn.read(buffer);
  if (bytesRead === null) throw new Error('Connection closed');
  
  return decoder.decode(buffer.subarray(0, bytesRead));
}

async function authenticateImap(conn: Deno.TcpConn, user: string, pass: string): Promise<boolean> {
  try {
    // Send LOGIN command
    const loginCommand = `A001 LOGIN "${user}" "${pass}"`;
    const response = await sendImapCommand(conn, loginCommand);
    console.log('IMAP AUTH Response successful');
    
    return response.includes('A001 OK');
  } catch (error) {
    console.error('IMAP authentication failed:', error);
    return false;
  }
}

async function syncEmailsForAccount(account: EmailAccount, supabase: any): Promise<number> {
  console.log(`Starting sync for account: ${account.email}`);
  
  const conn = await connectToImap(account.imap_config);
  if (!conn) {
    throw new Error('Failed to connect to IMAP server');
  }

  try {
    // Read initial greeting
    await sendImapCommand(conn, '');
    
    // Authenticate
    const authenticated = await authenticateImap(conn, account.imap_config.user, account.imap_config.pass);
    if (!authenticated) {
      throw new Error('IMAP authentication failed');
    }

    // Select INBOX
    await sendImapCommand(conn, 'A002 SELECT INBOX');
    
    // Get recent emails since last sync
    const lastSyncDate = account.last_sync ? new Date(account.last_sync) : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default: last 24 hours
    const sinceDate = lastSyncDate.toISOString().split('T')[0].replace(/-/g, '-');
    
    // Search for emails since last sync
    const searchResponse = await sendImapCommand(conn, `A003 SEARCH SINCE "${sinceDate}"`);
    console.log('Search response received');
    
    // Fetch message headers and bodies
    const fetchResponse = await sendImapCommand(conn, 'A004 FETCH 1:* (FLAGS ENVELOPE BODY[HEADER] BODY[TEXT])');
    console.log('Fetch response received');
    
    // Parse emails and save to database
    const emails = parseImapEmails(fetchResponse, account.id);
    
    let savedCount = 0;
    
    for (const email of emails) {
      try {
        // Check if email already exists
        const { data: existing } = await supabase
          .from('emails')
          .select('id')
          .eq('message_id', email.message_id)
          .eq('account_id', account.id)
          .single();
        
        if (!existing) {
          // Save new email
          const { error } = await supabase
            .from('emails')
            .insert(email);
          
          if (!error) {
            savedCount++;
          } else {
            console.error('Error saving email:', error);
          }
        }
      } catch (error) {
        console.error('Error processing email:', error);
      }
    }
    
    // Update last sync timestamp
    await supabase
      .from('email_accounts')
      .update({ 
        last_sync: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', account.id);
    
    await sendImapCommand(conn, 'A005 LOGOUT');
    
    console.log(`Sync completed for ${account.email}: ${savedCount} new emails`);
    return savedCount;
    
  } catch (error) {
    console.error('Email sync failed:', error);
    throw error;
  } finally {
    try {
      conn.close();
    } catch (e) {
      console.error('Error closing IMAP connection:', e);
    }
  }
}

function parseImapEmails(response: string, accountId: string): Email[] {
  const emails: Email[] = [];
  
  try {
    // Simplified parser - in production you'd want a more robust IMAP parser
    const lines = response.split('\n');
    let currentEmail: Partial<Email> = {};
    let emailIndex = 0;
    
    for (const line of lines) {
      if (line.includes('ENVELOPE')) {
        emailIndex++;
        const messageId = `${accountId}_${Date.now()}_${emailIndex}`;
        
        currentEmail = {
          id: crypto.randomUUID(),
          account_id: accountId,
          message_id: messageId,
          read: !line.includes('\\Recent'),
          starred: line.includes('\\Flagged'),
          hasAttachments: line.includes('attachment'),
          folder: 'INBOX',
          date: new Date().toISOString()
        };
      }
      
      if (line.startsWith('Subject:')) {
        currentEmail.subject = line.replace('Subject:', '').trim();
      }
      
      if (line.startsWith('From:')) {
        currentEmail.from = line.replace('From:', '').trim();
      }
      
      if (line.startsWith('To:')) {
        currentEmail.to = line.replace('To:', '').trim();
      }
      
      if (line.startsWith('Date:')) {
        try {
          currentEmail.date = new Date(line.replace('Date:', '').trim()).toISOString();
        } catch {
          currentEmail.date = new Date().toISOString();
        }
      }
      
      // Extract body content
      if (line.trim() && !line.includes(':') && currentEmail.subject) {
        currentEmail.body = (currentEmail.body || '') + line.trim() + '\n';
      }
      
      // If we have enough data for an email, add it
      if (currentEmail.id && currentEmail.subject && currentEmail.from) {
        currentEmail.body = currentEmail.body || 'Email content could not be extracted.';
        emails.push(currentEmail as Email);
        currentEmail = {};
      }
    }
    
    return emails;
  } catch (error) {
    console.error('Error parsing IMAP response:', error);
    return [];
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Scheduled email sync function called');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get all active email accounts
    const { data: accounts, error } = await supabase
      .from('email_accounts')
      .select('*')
      .eq('active', true);
    
    if (error) {
      throw error;
    }
    
    if (!accounts || accounts.length === 0) {
      console.log('No active email accounts found');
      return new Response(JSON.stringify({
        success: true,
        message: 'No active email accounts to sync',
        synced_accounts: 0,
        total_emails: 0
      }), {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }
      });
    }
    
    console.log(`Found ${accounts.length} active email accounts to sync`);
    
    let totalSyncedEmails = 0;
    let successfulSyncs = 0;
    const syncResults = [];
    
    // Sync each account
    for (const account of accounts) {
      try {
        const syncedCount = await syncEmailsForAccount(account, supabase);
        totalSyncedEmails += syncedCount;
        successfulSyncs++;
        
        syncResults.push({
          account_id: account.id,
          email: account.email,
          synced_emails: syncedCount,
          success: true
        });
        
        console.log(`Successfully synced ${syncedCount} emails for ${account.email}`);
      } catch (error) {
        console.error(`Failed to sync account ${account.email}:`, error);
        
        syncResults.push({
          account_id: account.id,
          email: account.email,
          synced_emails: 0,
          success: false,
          error: error.message
        });
      }
    }
    
    console.log(`Email sync completed: ${successfulSyncs}/${accounts.length} accounts, ${totalSyncedEmails} total emails`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Email sync completed',
      synced_accounts: successfulSyncs,
      total_accounts: accounts.length,
      total_emails: totalSyncedEmails,
      results: syncResults
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      }
    });

  } catch (error: any) {
    console.error('Error in sync-emails-scheduled function:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to sync emails',
      synced_accounts: 0,
      total_emails: 0
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      }
    });
  }
};

serve(handler);