import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FetchEmailsRequest {
  imap_config: {
    server: string;
    port: number;
    email: string;
    password: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Fetch emails function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const { imap_config }: FetchEmailsRequest = await req.json();

    console.log("Fetching emails for:", imap_config.email);

    // Mock emails for demonstration - in a real implementation, 
    // you would connect to the IMAP server to fetch actual emails
    const mockEmails = [
      {
        id: "1",
        from: "cliente@example.com",
        to: imap_config.email,
        subject: "Richiesta preventivo abbattitore",
        body: "Buongiorno, vorrei ricevere un preventivo per un abbattitore di temperatura per il mio ristorante. La capacità dovrebbe essere di circa 10 teglie GN 1/1. Attendo vostre notizie. Cordiali saluti.",
        date: new Date().toISOString(),
        read: false,
        starred: false
      },
      {
        id: "2",
        from: "fornitore@supplier.com", 
        to: imap_config.email,
        subject: "Conferma ordine materiali",
        body: "Confermiamo la ricezione del vostro ordine di materiali per la produzione. La consegna è prevista per la prossima settimana. Allegate trovate le specifiche tecniche aggiornate.",
        date: new Date(Date.now() - 3600000).toISOString(),
        read: true,
        starred: true
      },
      {
        id: "3",
        from: "supporto@zapper.it",
        to: imap_config.email,
        subject: "Aggiornamento sistema ERP",
        body: "Il sistema ERP sarà aggiornato questa sera dalle 22:00 alle 24:00. Durante questo periodo potrebbero verificarsi brevi interruzioni del servizio. Ci scusiamo per il disagio.",
        date: new Date(Date.now() - 7200000).toISOString(),
        read: false,
        starred: false
      }
    ];

    console.log("Returning mock emails:", mockEmails.length);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emails: mockEmails,
        count: mockEmails.length
      }), 
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in fetch-emails function:", error);
    
    return new Response(
      JSON.stringify({ 
        error: "Errore durante il recupero delle email", 
        details: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);