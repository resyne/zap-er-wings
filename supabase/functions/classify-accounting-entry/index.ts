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

    const systemPrompt = `Sei un esperto contabile italiano. Devi classificare una registrazione contabile.

DATI DELLA REGISTRAZIONE:
- Direzione: ${entry.direction} (entrata = incasso, uscita = spesa)
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
1. Se direction="uscita" → event_type="costo", affects_income_statement=true
2. Se direction="entrata" → event_type="ricavo", affects_income_statement=true
3. Scegli il conto più appropriato dal piano dei conti
4. Per i costi scegli un centro di costo, per i ricavi un centro di ricavo
5. financial_status: se direction="uscita" → "pagato" o "da_pagare"; se direction="entrata" → "incassato" o "da_incassare"
6. temporal_competence di default è "immediata"

Analizza i dati e suggerisci la classificazione migliore.`;

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
              { type: "text", text: "Analizza questo documento e suggerisci la classificazione contabile appropriata." },
              { type: "image_url", image_url: { url: dataUrl } }
            ]
          });
        } else {
          messages.push({
            role: "user",
            content: "Suggerisci la classificazione contabile appropriata basandoti sui dati disponibili."
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
              description: "Classifica la registrazione contabile",
              parameters: {
                type: "object",
                properties: {
                  event_type: {
                    type: "string",
                    enum: ["ricavo", "costo", "evento_finanziario", "assestamento", "evento_interno"],
                    description: "Tipo di evento contabile"
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
                  reasoning: {
                    type: "string",
                    description: "Breve spiegazione della classificazione suggerita"
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
