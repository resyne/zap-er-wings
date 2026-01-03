import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function fileToDataUrl(url: string): Promise<{ dataUrl: string; mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status}`);
  }
  
  const contentType = response.headers.get("content-type") || "application/octet-stream";
  const arrayBuffer = await response.arrayBuffer();
  const base64 = base64Encode(new Uint8Array(arrayBuffer));
  
  return {
    dataUrl: `data:${contentType};base64,${base64}`,
    mimeType: contentType
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { entry, chartOfAccounts, costCenters, profitCenters } = await req.json();

    if (!entry) {
      return new Response(
        JSON.stringify({ success: false, error: "Entry data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client to search for existing customers/suppliers
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Classifying entry:", entry.id);

    // Build context about available accounts and centers
    const accountsContext = chartOfAccounts?.map((a: any) => 
      `- ${a.name} (${a.account_type}, id: ${a.id})`
    ).join("\n") || "Nessun conto disponibile";

    const costCentersContext = costCenters?.map((c: any) => 
      `- ${c.name} (id: ${c.id})`
    ).join("\n") || "Nessun centro di costo";

    const profitCentersContext = profitCenters?.map((c: any) => 
      `- ${c.name} (id: ${c.id})`
    ).join("\n") || "Nessun centro di ricavo";

    // Extract filename for additional context
    const attachmentUrl = entry.attachment_url || "";
    const filename = attachmentUrl.split("/").pop()?.split("?")[0] || "";
    const decodedFilename = decodeURIComponent(filename);
    
    // Detect if filename indicates this is a sales invoice from Climatel
    const isFromClimatel = /climatel|elefante/i.test(decodedFilename);
    const filenameHint = isFromClimatel 
      ? `\n\n⚠️ ATTENZIONE: Il nome del file "${decodedFilename}" contiene "Climatel" o "Elefante", questo indica che è una FATTURA EMESSA DA Climatel verso un cliente. Il soggetto economico è quindi un CLIENTE, non un fornitore!`
      : "";

    const systemPrompt = `Sei un esperto contabile italiano. Devi classificare una registrazione contabile e identificare il soggetto economico.

AZIENDA DI RIFERIMENTO: "Climatel di Elefante Pasquale" (varianti: Climatel, CLIMATEL, Elefante Pasquale)
- Se la fattura è EMESSA DA Climatel verso qualcun altro → è una FATTURA DI VENDITA (ricavo, entrata), l'altro soggetto è un CLIENTE
- Se la fattura è EMESSA DA un altro soggetto verso Climatel → è una FATTURA DI ACQUISTO (costo, uscita), l'altro soggetto è un FORNITORE
${filenameHint}

DATI DELLA REGISTRAZIONE:
- Nome file allegato: ${decodedFilename || "nessun allegato"}
- Direzione inserita: ${entry.direction} (entrata = incasso, uscita = spesa)
- Tipo documento: ${entry.document_type}
- Importo: € ${entry.amount}
- Data documento: ${entry.document_date}
- Metodo pagamento: ${entry.payment_method || "non specificato"}
- Note dipendente: ${entry.note || "nessuna"}

PIANO DEI CONTI DISPONIBILE:
${accountsContext}

CENTRI DI COSTO DISPONIBILI:
${costCentersContext}

CENTRI DI RICAVO DISPONIBILI:
${profitCentersContext}

REGOLE DI CLASSIFICAZIONE:
1. PRIMA analizza il nome file e il documento per capire CHI è l'emittente e CHI è il destinatario
2. Se nel nome file c'è "Climatel" o "Elefante" → la fattura è EMESSA DA Climatel, quindi è un RICAVO e il soggetto è un CLIENTE
3. Se l'emittente NON è Climatel → è un COSTO e il soggetto è un FORNITORE
4. La direzione potrebbe essere errata, fidati del documento e del nome file!
5. Estrai sempre i dati del SOGGETTO ECONOMICO (cliente se ricavo, fornitore se costo):
   - Nome/Ragione sociale
   - Partita IVA (se presente)
   - Indirizzo/Città (se presenti)
6. Per i costi scegli un centro di costo, per i ricavi un centro di ricavo
7. financial_status: per vendite → "incassato" o "da_incassare"; per acquisti → "pagato" o "da_pagare"

Analizza attentamente e suggerisci la classificazione corretta, correggendo la direzione se necessario.`;

    // Prepare messages - optionally include document image
    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    // Try to include the document image for better analysis
    if (entry.attachment_url) {
      try {
        const { dataUrl, mimeType } = await fileToDataUrl(entry.attachment_url);
        const isPdf = mimeType === "application/pdf" || entry.attachment_url.toLowerCase().endsWith(".pdf");
        
        if (!isPdf) {
          messages.push({
            role: "user",
            content: [
              { type: "text", text: "Analizza questo documento: identifica emittente, destinatario, e suggerisci la classificazione contabile. Estrai anche i dati del soggetto economico (cliente o fornitore)." },
              { type: "image_url", image_url: { url: dataUrl } }
            ]
          });
        } else {
          messages.push({
            role: "user",
            content: "Suggerisci la classificazione contabile appropriata basandoti sui dati disponibili. Non posso visualizzare il PDF, usa le informazioni testuali."
          });
        }
      } catch (e) {
        console.log("Could not load attachment, proceeding without image");
        messages.push({
          role: "user",
          content: "Suggerisci la classificazione contabile appropriata basandoti sui dati disponibili."
        });
      }
    } else {
      messages.push({
        role: "user",
        content: "Suggerisci la classificazione contabile appropriata basandoti sui dati disponibili."
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools: [
          {
            type: "function",
            function: {
              name: "classify_entry",
              description: "Classifica la registrazione contabile e identifica il soggetto economico",
              parameters: {
                type: "object",
                properties: {
                  event_type: {
                    type: "string",
                    enum: ["ricavo", "costo", "evento_finanziario", "assestamento", "evento_interno"],
                    description: "Tipo di evento contabile (ricavo se fattura di vendita, costo se fattura di acquisto)"
                  },
                  correct_direction: {
                    type: "string",
                    enum: ["entrata", "uscita"],
                    description: "La direzione CORRETTA basata sul documento (entrata per ricavi, uscita per costi)"
                  },
                  affects_income_statement: {
                    type: "boolean",
                    description: "Se incide sul conto economico"
                  },
                  chart_account_id: {
                    type: "string",
                    description: "ID del conto del piano dei conti"
                  },
                  account_category: {
                    type: "string",
                    enum: ["revenue", "cogs", "opex"],
                    description: "Categoria macro del conto"
                  },
                  temporal_competence: {
                    type: "string",
                    enum: ["immediata", "differita", "rateizzata"],
                    description: "Competenza temporale"
                  },
                  cost_center_id: {
                    type: "string",
                    description: "ID del centro di costo (per i costi)"
                  },
                  profit_center_id: {
                    type: "string",
                    description: "ID del centro di ricavo (per i ricavi)"
                  },
                  financial_status: {
                    type: "string",
                    enum: ["pagato", "da_pagare", "incassato", "da_incassare", "anticipato_dipendente"],
                    description: "Stato finanziario"
                  },
                  // Extracted subject data
                  subject_type: {
                    type: "string",
                    enum: ["cliente", "fornitore"],
                    description: "Tipo di soggetto economico: cliente se è una fattura di vendita, fornitore se è una fattura di acquisto"
                  },
                  subject_name: {
                    type: "string",
                    description: "Nome o ragione sociale del soggetto (il cliente o fornitore)"
                  },
                  subject_tax_id: {
                    type: "string",
                    description: "Partita IVA o Codice Fiscale del soggetto"
                  },
                  subject_address: {
                    type: "string",
                    description: "Indirizzo del soggetto"
                  },
                  subject_city: {
                    type: "string",
                    description: "Città e provincia del soggetto (es. 'Vico Equense (NA)')"
                  },
                  reasoning: {
                    type: "string",
                    description: "Breve spiegazione della classificazione suggerita, incluso chi è l'emittente e chi il destinatario della fattura"
                  },
                  confidence: {
                    type: "string",
                    enum: ["high", "medium", "low"],
                    description: "Livello di confidenza nella classificazione"
                  }
                },
                required: ["event_type", "affects_income_statement", "reasoning"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "classify_entry" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded, riprova tra poco." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "Crediti esauriti, aggiungi crediti al workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: "Errore nell'analisi AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("AI response:", JSON.stringify(data));

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const classification = JSON.parse(toolCall.function.arguments);
      console.log("Classification:", classification);
      
      // If we have subject data, try to find existing customer or supplier
      let existingSubject = null;
      let subjectMatches: any[] = [];
      
      if (classification.subject_name || classification.subject_tax_id) {
        const subjectType = classification.subject_type || (classification.event_type === "ricavo" ? "cliente" : "fornitore");
        
        if (subjectType === "cliente") {
          // Search in customers table
          let query = supabase.from("customers").select("id, name, company_name, tax_id, city, address");
          
          // Search by tax_id first (most reliable)
          if (classification.subject_tax_id) {
            const taxId = classification.subject_tax_id.replace(/\s/g, "");
            const { data: byTaxId } = await query.ilike("tax_id", `%${taxId}%`);
            if (byTaxId && byTaxId.length > 0) {
              existingSubject = byTaxId[0];
              subjectMatches = byTaxId;
            }
          }
          
          // If no match by tax_id, search by name
          if (!existingSubject && classification.subject_name) {
            const { data: byName } = await supabase
              .from("customers")
              .select("id, name, company_name, tax_id, city, address")
              .or(`name.ilike.%${classification.subject_name}%,company_name.ilike.%${classification.subject_name}%`);
            if (byName && byName.length > 0) {
              existingSubject = byName[0];
              subjectMatches = byName;
            }
          }
        } else {
          // Search in suppliers table
          let query = supabase.from("suppliers").select("id, name, tax_id, city, address");
          
          // Search by tax_id first
          if (classification.subject_tax_id) {
            const taxId = classification.subject_tax_id.replace(/\s/g, "");
            const { data: byTaxId } = await query.ilike("tax_id", `%${taxId}%`);
            if (byTaxId && byTaxId.length > 0) {
              existingSubject = byTaxId[0];
              subjectMatches = byTaxId;
            }
          }
          
          // If no match by tax_id, search by name
          if (!existingSubject && classification.subject_name) {
            const { data: byName } = await supabase
              .from("suppliers")
              .select("id, name, tax_id, city, address")
              .ilike("name", `%${classification.subject_name}%`);
            if (byName && byName.length > 0) {
              existingSubject = byName[0];
              subjectMatches = byName;
            }
          }
        }
        
        classification.existing_subject = existingSubject;
        classification.subject_matches = subjectMatches;
        classification.subject_found = !!existingSubject;
      }
      
      return new Response(
        JSON.stringify({ success: true, classification }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Impossibile generare classificazione" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error classifying entry:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
