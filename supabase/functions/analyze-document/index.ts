import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Image URL is required" }),
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

    console.log("Analyzing document:", imageUrl);

    const systemPrompt = `Sei un assistente specializzato nell'analisi di documenti contabili italiani (fatture, scontrini, ricevute, estratti conto, rapporti di intervento).

Analizza l'immagine del documento e estrai i seguenti dati se presenti:
- direction: "entrata" se è un incasso/vendita, "uscita" se è una spesa/acquisto
- document_type: uno tra "fattura", "scontrino", "estratto_conto", "documento_interno", "rapporto_intervento", "altro"
- amount: l'importo totale in formato numerico (es: 150.50)
- document_date: la data del documento in formato YYYY-MM-DD
- payment_method: uno tra "contanti", "carta", "bonifico", "anticipo_personale", "non_so" (se identificabile)
- subject_type: uno tra "cliente", "fornitore", "interno" (se identificabile)
- notes: eventuali note o dettagli importanti estratti dal documento

Rispondi SOLO con i dati trovati, lasciando vuoti i campi non identificabili.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analizza questo documento e estrai i dati contabili.",
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_document_data",
              description: "Estrae i dati strutturati dal documento contabile",
              parameters: {
                type: "object",
                properties: {
                  direction: {
                    type: "string",
                    enum: ["entrata", "uscita"],
                    description: "Direzione del movimento: entrata per incassi, uscita per spese",
                  },
                  document_type: {
                    type: "string",
                    enum: ["fattura", "scontrino", "estratto_conto", "documento_interno", "rapporto_intervento", "altro"],
                    description: "Tipo di documento",
                  },
                  amount: {
                    type: "number",
                    description: "Importo totale del documento",
                  },
                  document_date: {
                    type: "string",
                    description: "Data del documento in formato YYYY-MM-DD",
                  },
                  payment_method: {
                    type: "string",
                    enum: ["contanti", "carta", "bonifico", "anticipo_personale", "non_so"],
                    description: "Metodo di pagamento se identificabile",
                  },
                  subject_type: {
                    type: "string",
                    enum: ["cliente", "fornitore", "interno"],
                    description: "Tipo di soggetto coinvolto",
                  },
                  notes: {
                    type: "string",
                    description: "Note o dettagli importanti estratti dal documento",
                  },
                  confidence: {
                    type: "string",
                    enum: ["high", "medium", "low"],
                    description: "Livello di confidenza nell'estrazione dei dati",
                  },
                },
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_document_data" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "Payment required, please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: "AI analysis failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("AI response:", JSON.stringify(data));

    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const extractedData = JSON.parse(toolCall.function.arguments);
      console.log("Extracted data:", extractedData);
      
      return new Response(
        JSON.stringify({ success: true, data: extractedData }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback: try to parse from content
    const content = data.choices?.[0]?.message?.content;
    console.log("No tool call, content:", content);
    
    return new Response(
      JSON.stringify({ success: true, data: {}, message: "Could not extract structured data" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error analyzing document:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
