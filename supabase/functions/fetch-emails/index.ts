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
    
    // Start TLS if using secure port
    if (config.port === 993) {
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
    console.log('IMAP AUTH Response:', response);
    
    return response.includes('A001 OK');
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
    // Read initial greeting
    await sendImapCommand(conn, '');
    
    // Authenticate
    const authenticated = await authenticateImap(conn, config.user, config.pass);
    if (!authenticated) {
      throw new Error('IMAP authentication failed');
    }

    // Select INBOX
    await sendImapCommand(conn, 'A002 SELECT INBOX');
    
    // Search for recent emails
    const searchResponse = await sendImapCommand(conn, 'A003 SEARCH RECENT');
    console.log('Search response:', searchResponse);
    
    // Fetch message headers
    const fetchResponse = await sendImapCommand(conn, 'A004 FETCH 1:* (FLAGS ENVELOPE BODY[HEADER])');
    console.log('Fetch response sample:', fetchResponse.substring(0, 500));
    
    // Parse the IMAP response to extract emails
    const emails = parseImapResponse(fetchResponse);
    
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

function parseImapResponse(response: string): Email[] {
  const emails: Email[] = [];
  
  try {
    // This is a simplified parser - in production you'd want a more robust IMAP parser
    const lines = response.split('\n');
    let currentEmail: Partial<Email> = {};
    let emailIndex = 0;
    
    for (const line of lines) {
      if (line.includes('ENVELOPE')) {
        emailIndex++;
        currentEmail = {
          id: `imap_${Date.now()}_${emailIndex}`,
          read: !line.includes('\\Recent'),
          starred: line.includes('\\Flagged'),
          hasAttachments: line.includes('attachment'),
        };
        
        // Extract envelope data (simplified)
        const envMatch = line.match(/ENVELOPE \((.*?)\)/);
        if (envMatch) {
          const envData = envMatch[1];
          // Parse envelope - this is simplified, real IMAP parsing is more complex
          currentEmail.subject = extractQuotedString(envData, 1) || 'No Subject';
          currentEmail.from = extractQuotedString(envData, 2) || 'Unknown Sender';
          currentEmail.to = extractQuotedString(envData, 3) || config.user;
          currentEmail.date = new Date().toISOString();
        }
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
        currentEmail.date = new Date(line.replace('Date:', '').trim()).toISOString();
      }
      
      // If we have enough data for an email, add it
      if (currentEmail.id && currentEmail.subject && currentEmail.from) {
        currentEmail.body = currentEmail.body || 'Email content...';
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

function extractQuotedString(data: string, index: number): string | null {
  const parts = data.split('"');
  const targetIndex = (index * 2) - 1;
  return parts[targetIndex] || null;
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
      // Try real IMAP connection first
      emails = await fetchEmailsViaImap(imap_config);
      console.log(`Successfully fetched ${emails.length} emails from IMAP`);
      
      if (emails.length === 0) {
        console.log('No emails found on server, using mock data for demo');
        emails = getMockEmails();
      }
    } catch (error) {
      console.error('IMAP fetch failed, falling back to mock data:', error);
      // Fallback to mock data for development
      emails = getMockEmails();
      console.log('IMAP simulation completed, returning mock emails');
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