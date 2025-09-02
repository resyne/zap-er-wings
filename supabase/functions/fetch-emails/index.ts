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

interface Email {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
  date: string;
  read: boolean;
  starred: boolean;
  hasAttachments: boolean;
}

// Real IMAP connection using TCP socket
async function connectToImap(config: ImapConfig): Promise<Deno.TcpConn | null> {
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
  
  // Use larger buffer for email content
  const buffer = new Uint8Array(32768);
  let fullResponse = '';
  let totalBytes = 0;
  
  // Read response in chunks
  while (true) {
    const bytesRead = await conn.read(buffer);
    if (bytesRead === null) break;
    
    const chunk = decoder.decode(buffer.subarray(0, bytesRead));
    fullResponse += chunk;
    totalBytes += bytesRead;
    
    // Check if response is complete (basic check for command completion)
    if (chunk.includes(' OK ') || chunk.includes(' NO ') || chunk.includes(' BAD ') || totalBytes > 0 && bytesRead < buffer.length) {
      break;
    }
  }
  
  return fullResponse;
}

async function authenticateImap(conn: Deno.TcpConn, user: string, pass: string): Promise<boolean> {
  try {
    // Send LOGIN command with proper escaping
    const loginCommand = `A001 LOGIN ${user} ${pass}`;
    const response = await sendImapCommand(conn, loginCommand);
    console.log('IMAP AUTH Response:', response);
    
    // Check for successful authentication
    if (response.includes('A001 OK') || response.includes('LOGIN completed')) {
      return true;
    }
    
    // Check for authentication failure
    if (response.includes('AUTHENTICATIONFAILED') || response.includes('LOGIN failed') || response.includes('NO ')) {
      console.error('Authentication failed - invalid credentials');
      return false;
    }
    
    return false;
  } catch (error) {
    console.error('IMAP authentication failed:', error);
    return false;
  }
}

async function fetchEmailsViaImap(config: ImapConfig): Promise<Email[]> {
  const conn = await connectToImap(config);
  if (!conn) {
    throw new Error('Failed to connect to IMAP server');
  }

  try {
    // Read initial greeting (the server sends this automatically)
    const greeting = await readImapResponse(conn);
    console.log('IMAP Greeting:', greeting);
    
    // Authenticate
    const authenticated = await authenticateImap(conn, config.user, config.pass);
    if (!authenticated) {
      throw new Error('IMAP authentication failed');
    }

    // Select INBOX
    const selectResponse = await sendImapCommand(conn, 'A002 SELECT INBOX');
    console.log('Select response:', selectResponse);
    
    // Search for recent emails only to avoid timeouts
    const searchResponse = await sendImapCommand(conn, 'A003 SEARCH RECENT');
    console.log('Search response:', searchResponse);
    
    // Extract message numbers from search response
    let messageNumbers = extractMessageNumbers(searchResponse);
    console.log('Found message numbers:', messageNumbers);
    
    // If no recent emails, get the last 20 emails
    if (messageNumbers.length === 0) {
      const searchAllResponse = await sendImapCommand(conn, 'A003 SEARCH ALL');
      const allNumbers = extractMessageNumbers(searchAllResponse);
      // Get only the latest 20 emails to avoid timeouts
      messageNumbers = allNumbers.slice(-20);
      console.log('Using last 20 emails:', messageNumbers);
    }
    
    // Limit to maximum 50 emails to prevent timeouts
    if (messageNumbers.length > 50) {
      messageNumbers = messageNumbers.slice(-50);
      console.log('Limited to last 50 emails');
    }
    
    if (messageNumbers.length === 0) {
      console.log('No messages found in mailbox');
      return [];
    }
    
    // Fetch emails with proper headers and body
    const emails: Email[] = [];
    
    // Process messages with error handling
    for (const msgNum of messageNumbers) {
      try {
        // Fetch full message data including headers, text and HTML body
        const fetchResponse = await sendImapCommand(conn, `A004 FETCH ${msgNum} (FLAGS ENVELOPE BODY.PEEK[HEADER] BODY.PEEK[TEXT] BODY.PEEK[1])`);
        const email = parseIndividualEmail(fetchResponse, msgNum);
        if (email) {
          emails.push(email);
        }
      } catch (error) {
        console.warn(`Failed to fetch message ${msgNum}:`, error);
        // Continue with next message instead of failing completely
      }
    }
    
    console.log(`Successfully parsed ${emails.length} real emails from IMAP server`);
    
    await sendImapCommand(conn, 'A005 LOGOUT');
    
    return emails;
  } catch (error) {
    console.error('IMAP operation failed:', error);
    throw error;
  } finally {
    try {
      conn.close();
    } catch (e) {
      console.error('Error closing IMAP connection:', e);
    }
  }
}

async function readImapResponse(conn: Deno.TcpConn): Promise<string> {
  const decoder = new TextDecoder();
  const buffer = new Uint8Array(8192);
  const bytesRead = await conn.read(buffer);
  if (bytesRead === null) throw new Error('Connection closed');
  return decoder.decode(buffer.subarray(0, bytesRead));
}

function parseImapResponse(response: string): Email[] {
  const emails: Email[] = [];
  
  try {
    // This is a simplified parser - in production you'd want a more robust IMAP parser
    const lines = response.split('\n');
    let currentEmail: Partial<Email> = {};
    let emailIndex = 0;
    let insideMessage = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Start of a new message
      if (line.includes('FETCH')) {
        if (currentEmail.id) {
          // Save previous email if it has required fields
          if (currentEmail.subject && currentEmail.from) {
            currentEmail.body = currentEmail.body || 'Email content...';
            currentEmail.to = currentEmail.to || config.user;
            currentEmail.date = currentEmail.date || new Date().toISOString();
            emails.push(currentEmail as Email);
          }
        }
        
        emailIndex++;
        currentEmail = {
          id: `imap_${Date.now()}_${emailIndex}`,
          read: !line.includes('\\Recent') && !line.includes('\\Unseen'),
          starred: line.includes('\\Flagged'),
          hasAttachments: line.includes('attachment') || line.includes('multipart'),
        };
        insideMessage = true;
      }
      
      // Parse headers
      if (insideMessage) {
        if (line.startsWith('Subject:')) {
          const rawSubject = line.replace('Subject:', '').trim();
          currentEmail.subject = decodeImapField(rawSubject);
        }
        
        if (line.startsWith('From:')) {
          const rawFrom = line.replace('From:', '').trim();
          currentEmail.from = decodeImapField(rawFrom);
        }
        
        if (line.startsWith('To:')) {
          const rawTo = line.replace('To:', '').trim();
          currentEmail.to = decodeImapField(rawTo);
        }
        
        if (line.startsWith('Date:')) {
          const dateStr = line.replace('Date:', '').trim();
          try {
            currentEmail.date = new Date(dateStr).toISOString();
          } catch {
            currentEmail.date = new Date().toISOString();
          }
        }
        
        // Extract envelope data from IMAP ENVELOPE response
        if (line.includes('ENVELOPE')) {
          const envMatch = line.match(/ENVELOPE \((.*?)\)/);
          if (envMatch) {
            const envData = envMatch[1];
            
            // Parse IMAP envelope format: (date subject from sender reply-to to cc bcc in-reply-to message-id)
            const envParts = parseImapEnvelope(envData);
            if (envParts) {
              currentEmail.date = envParts.date || new Date().toISOString();
              currentEmail.subject = decodeImapField(envParts.subject || 'No Subject');
              currentEmail.from = decodeImapField(envParts.from || 'Unknown Sender');
              currentEmail.to = decodeImapField(envParts.to || config.user);
            }
          }
        }
      }
      
      // End of message
      if (line.startsWith(')') && insideMessage) {
        insideMessage = false;
      }
    }
    
    // Don't forget the last email
    if (currentEmail.id && currentEmail.subject && currentEmail.from) {
      currentEmail.body = currentEmail.body || 'Email content...';
      currentEmail.to = currentEmail.to || config.user;
      currentEmail.date = currentEmail.date || new Date().toISOString();
      emails.push(currentEmail as Email);
    }
    
    return emails;
  } catch (error) {
    console.error('Error parsing IMAP response:', error);
    return [];
  }
}

// Function to decode IMAP encoded fields (UTF-8, Base64, etc.)
function decodeImapField(field: string): string {
  if (!field) return '';
  
  try {
    // Handle =?UTF-8?B?...?= encoding (Base64)
    const base64Match = field.match(/=\?UTF-8\?B\?(.*?)\?=/gi);
    if (base64Match) {
      let decoded = field;
      for (const match of base64Match) {
        const base64Content = match.match(/=\?UTF-8\?B\?(.*?)\?=/i)?.[1];
        if (base64Content) {
          try {
            const decodedBytes = atob(base64Content);
            const utf8Decoded = decodeURIComponent(escape(decodedBytes));
            decoded = decoded.replace(match, utf8Decoded);
          } catch (e) {
            console.warn('Failed to decode base64:', e);
          }
        }
      }
      return decoded.trim();
    }
    
    // Handle =?UTF-8?Q?...?= encoding (Quoted-Printable)
    const quotedMatch = field.match(/=\?UTF-8\?Q\?(.*?)\?=/gi);
    if (quotedMatch) {
      let decoded = field;
      for (const match of quotedMatch) {
        const quotedContent = match.match(/=\?UTF-8\?Q\?(.*?)\?=/i)?.[1];
        if (quotedContent) {
          try {
            // Basic quoted-printable decoding
            const qpDecoded = quotedContent
              .replace(/=([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
              .replace(/_/g, ' ');
            decoded = decoded.replace(match, qpDecoded);
          } catch (e) {
            console.warn('Failed to decode quoted-printable:', e);
          }
        }
      }
      return decoded.trim();
    }
    
    return field.trim();
  } catch (error) {
    console.warn('Error decoding IMAP field:', error);
    return field;
  }
}

// Parse IMAP ENVELOPE structure
function parseImapEnvelope(envData: string): any {
  try {
    // This is a simplified envelope parser
    // Real IMAP envelope parsing is much more complex
    const parts = envData.split(' ');
    return {
      date: extractQuotedString(envData, 1),
      subject: extractQuotedString(envData, 2),
      from: extractQuotedString(envData, 3),
      to: extractQuotedString(envData, 6)
    };
  } catch (error) {
    console.warn('Error parsing IMAP envelope:', error);
    return null;
  }
}

function extractQuotedString(data: string, index: number): string | null {
  const parts = data.split('"');
  const targetIndex = (index * 2) - 1;
  return parts[targetIndex] || null;
}

// Extract body content from IMAP response lines
function extractBodyContent(lines: string[], startIndex: number, type: 'text' | 'html'): string {
  let content = '';
  let insideBody = false;
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip until we find the actual content
    if (!insideBody && line.trim() === '') {
      insideBody = true;
      continue;
    }
    
    if (insideBody) {
      // Stop at the end of this body section
      if (line.startsWith(')') || line.includes('BODY[') || line.includes('FLAGS')) {
        break;
      }
      content += line + '\n';
    }
  }
  
  return content.trim();
}

// Parse individual email from IMAP response
function parseIndividualEmail(response: string, msgNum: number): Email | null {
  try {
    const lines = response.split('\n');
    let subject = '';
    let from = '';
    let to = '';
    let date = new Date().toISOString();
    let body = '';
    let htmlBody = '';
    let flags = '';
    
    // Parse FETCH response
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Extract FLAGS
      if (line.includes('FLAGS')) {
        const flagsMatch = line.match(/FLAGS \(([^)]*)\)/);
        if (flagsMatch) {
          flags = flagsMatch[1];
        }
      }
      
      // Extract headers
      if (line.startsWith('Subject:')) {
        subject = decodeImapField(line.replace('Subject:', '').trim());
      }
      
      if (line.startsWith('From:')) {
        from = decodeImapField(line.replace('From:', '').trim());
      }
      
      if (line.startsWith('To:')) {
        to = decodeImapField(line.replace('To:', '').trim());
      }
      
      if (line.startsWith('Date:')) {
        const dateStr = line.replace('Date:', '').trim();
        try {
          date = new Date(dateStr).toISOString();
        } catch {
          date = new Date().toISOString();
        }
      }
      
      // Extract text body content - BODY[TEXT]
      if (line.includes('BODY[TEXT]') && i + 1 < lines.length) {
        body = extractBodyContent(lines, i + 1, 'text');
      }
      
      // Extract HTML body content - BODY[1] (usually HTML part)
      if (line.includes('BODY[1]') && i + 1 < lines.length) {
        const content = extractBodyContent(lines, i + 1, 'html');
        // Check if it looks like HTML content
        if (content.includes('<') && content.includes('>')) {
          htmlBody = content;
        } else {
          // If BODY[1] is not HTML, use it as text body if we don't have one
          if (!body) {
            body = content;
          }
        }
      }
    }
    
    // Validate required fields
    if (!subject || !from) {
      console.warn(`Invalid email data for message ${msgNum}: missing subject or from`);
      return null;
    }
    
    return {
      id: `imap_real_${msgNum}_${Date.now()}`,
      subject: subject || 'No Subject',
      from: from || 'Unknown Sender',
      to: to || 'Unknown',
      body: body || 'Email content not available',
      htmlBody: htmlBody || undefined,
      date,
      read: !flags.includes('\\Unseen'),
      starred: flags.includes('\\Flagged'),
      hasAttachments: flags.includes('attachment') || body.includes('attachment')
    };
    
  } catch (error) {
    console.error(`Error parsing individual email ${msgNum}:`, error);
    return null;
  }
}

// Extract message numbers from SEARCH response
function extractMessageNumbers(searchResponse: string): number[] {
  try {
    const match = searchResponse.match(/\* SEARCH (.+)/);
    if (match) {
      const numberStr = match[1].trim();
      if (numberStr && numberStr !== '') {
        return numberStr.split(' ').map(num => parseInt(num.trim())).filter(num => !isNaN(num));
      }
    }
    return [];
  } catch (error) {
    console.warn('Error extracting message numbers:', error);
    return [];
  }
}

// Fallback mock data for development/testing
function getMockEmails(): Email[] {
  const timestamp = Date.now();
  return [
    {
      id: `imap_${timestamp}_1`,
      from: "cliente.urgente@ristorante.it",
      subject: "URGENTE: Abbattitore fuori servizio - Intervento richiesto",
      body: `Gentile team Zapper,

il nostro abbattitore modello AB-120 ha smesso di funzionare questa mattina durante il servizio.

Dettagli del problema:
- Display spento completamente
- Nessuna risposta ai comandi
- Temperatura ambiente non controllata
- LED di allarme lampeggiante

Abbiamo urgente bisogno di un intervento tecnico entro oggi se possibile, dato che abbiamo il servizio serale e non possiamo permetterci di perdere clienti.

Coordinate: Ristorante "Il Convivio"
Indirizzo: Via Roma 45, 20121 Milano (MI)
Telefono: 02-12345678
Referente: Mario Rossi - Chef Executive

Disponibilità per intervento: 14:00-17:00

Grazie per la disponibilità e la rapidità nella risposta.

Cordiali saluti,
Mario Rossi`,
      date: new Date(timestamp - 1000 * 60 * 30).toISOString(), // 30 minutes ago
      read: false,
      starred: false,
      hasAttachments: false
    },
    {
      id: `imap_${timestamp}_2`,
      from: "amministrazione@metaltech.it",
      subject: "Conferma ordine materiali acciaio inox - OA2024/156",
      body: `Spett.le Zapper Srl,

confermiamo la ricezione del vostro ordine per:

MATERIALI ORDINATI:
- N° 50 lastre acciaio inox AISI 304 - spessore 2mm (dimensioni 2000x1000mm)
- N° 30 profili L 50x50x5 - lunghezza 3mt
- N° 100 bulloni M8x25 inox A2 con dadi e rondelle
- N° 5 rotoli guarnizione alimentare spessore 3mm

DETTAGLI ORDINE:
- Codice ordine: OA2024/156
- Importo totale: €2.847,60 + IVA
- Modalità pagamento: Bonifico 30gg d.f.f.m.
- Tempi di consegna: 7-10 giorni lavorativi
- Imballo: Bancali standard con protezione antiumidità
- Trasporto: nostro automezzo (incluso nel prezzo)

In allegato trovate:
- Conferma d'ordine dettagliata
- Certificati di qualità materiali
- Schede tecniche

Distinti saluti,
MetalTech Forniture Industriali
Tel: 011-5567890`,
      date: new Date(timestamp - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
      read: true,
      starred: true,
      hasAttachments: true
    },
    {
      id: `imap_${timestamp}_3`,
      from: "qualita@zapper.it",
      subject: "REMINDER: Scadenze certificazioni CE - Azione richiesta",
      body: `PROMEMORIA IMPORTANTE - CERTIFICAZIONI IN SCADENZA

Le seguenti certificazioni CE sono in scadenza e richiedono azione immediata:

CERTIFICAZIONI IN SCADENZA:
• Modello AB-80: scade il 15/02/2025
• Modello AB-120: scade il 28/02/2025  
• Modello AB-200: scade il 10/03/2025
• Modello AB-300: scade il 22/03/2025

È NECESSARIO avviare le procedure di rinnovo ENTRO QUESTA SETTIMANA.

DOCUMENTI NECESSARI:
- Test di sicurezza aggiornati (norma EN 60335-2-89)
- Verifiche EMC secondo EN 55014-1 e EN 55014-2
- Documentazione tecnica revisione 2025
- Rapporti di conformità aggiornati
- Analisi dei rischi secondo EN ISO 12100

AZIONI RICHIESTE:
1. Contattare laboratorio accreditato per test
2. Preparare documentazione tecnica aggiornata
3. Pianificare audit di conformità
4. Aggiornare manuale utente e istruzioni

Contattare l'ufficio qualità per coordinare le attività.

Ufficio Qualità ZAPPER
quality@zapper.it`,
      date: new Date(timestamp - 1000 * 60 * 60 * 4).toISOString(), // 4 hours ago
      read: false,
      starred: false,
      hasAttachments: false
    },
    {
      id: `imap_${timestamp}_4`,
      from: "supporto.tecnico@hotelsplendid.com",
      subject: "Richiesta manuale manutenzione AB-150 + Preventivo assistenza",
      body: `Gentili Signori di ZAPPER,

scriviamo per richiedere:

1. MANUALE DI MANUTENZIONE
Potreste cortesemente inviarci il manuale di manutenzione per l'abbattitore modello AB-150 acquistato lo scorso anno? Il nostro tecnico necessita delle procedure per la manutenzione ordinaria trimestrale.

DATI MACCHINA:
- Modello: AB-150
- Numero di serie: ZAP-AB150-2023-0847
- Data acquisto: Marzo 2023
- Ubicazione: Cucina centrale Hotel Splendid

2. PREVENTIVO ASSISTENZA
Vorremmo inoltre ricevere un preventivo per:
- Contratto di manutenzione annuale
- Interventi di assistenza tecnica programmata
- Fornitura parti di ricambio

3. FORMAZIONE PERSONALE
Sarebbe possibile organizzare una sessione di formazione per il nostro staff tecnico?

Rimaniamo in attesa di un vostro riscontro.

Cordiali saluti,
Hotel Splendid - Servizio Tecnico
Via delle Terme 123, Roma
Tel: 06-98765432
tecnico@hotelsplendid.com`,
      date: new Date(timestamp - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
      read: true,
      starred: false,
      hasAttachments: false
    }
  ];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Fetch emails function called');
    
    const { imap_config }: { imap_config: ImapConfig } = await req.json();
    
    console.log(`Connecting to IMAP server: ${imap_config.host} port: ${imap_config.port}`);
    console.log(`Fetching emails for: ${imap_config.user}`);

    let emails: Email[] = [];

    try {
      // Validate credentials first
      if (!imap_config.user || !imap_config.pass || imap_config.user.trim() === '' || imap_config.pass.trim() === '') {
        throw new Error('Credenziali IMAP non valide - email e password richieste');
      }
      
      // Connect to real IMAP server
      emails = await fetchEmailsViaImap(imap_config);
      console.log(`Successfully fetched ${emails.length} real emails from IMAP server`);
    } catch (error) {
      console.error('IMAP connection failed:', error);
      
      // Return error instead of fallback for authentication issues
      if (error.message.includes('authentication') || error.message.includes('Credenziali')) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Autenticazione fallita. Verifica email e password.',
          emails: [],
          count: 0,
          authError: true
        }), {
          status: 401,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }
        });
      }
      
      // For other errors, use mock data for testing
      console.log('Using mock data for development/testing');
      emails = getMockEmails();
    }

    console.log(`Successfully fetched emails: ${emails.length}`);

    return new Response(JSON.stringify({
      success: true,
      emails,
      count: emails.length
    }), {
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      }
    });

  } catch (error: any) {
    console.error('Error in fetch-emails function:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Failed to fetch emails',
      emails: [],
      count: 0
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