import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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

    console.log("Analyzing invoice:", imageUrl);

    const { dataUrl, mimeType } = await fileToDataUrl(imageUrl);
    console.log("Converted to data URL, MIME type:", mimeType);
    
    const isPdf = mimeType === "application/pdf" || imageUrl.toLowerCase().endsWith(".pdf");
    const model = isPdf ? "openai/gpt-5-mini" : "google/gemini-2.5-flash";
    console.log("Using model:", model);

    const systemPrompt = `Sei un assistente specializzato nell'analisi di fatture italiane (fatture di vendita, acquisto, note di credito).

Analizza l'immagine della fattura e estrai i seguenti dati:

DATI FATTURA:
- invoice_number: numero della fattura
- invoice_date: data della fattura in formato YYYY-MM-DD
- invoice_type: "vendita" se siamo noi che emettiamo, "acquisto" se riceviamo da fornitore, "nota_credito" se è una nota di credito
- subject_name: nome/ragione sociale del cliente o fornitore
- subject_type: "cliente" se vendiamo, "fornitore" se acquistiamo
- imponibile: importo imponibile (senza IVA)
- iva_rate: aliquota IVA (es: 22, 10, 4, 0)
- iva_amount: importo IVA
- total_amount: importo totale
- vat_regime: "domestica_imponibile" per operazioni normali, "ue_non_imponibile" per UE, "extra_ue" per paesi extra-UE, "reverse_charge" per reverse charge
- due_date: data scadenza pagamento in formato YYYY-MM-DD (se presente)
- payment_method: metodo di pagamento se indicato
- notes: eventuali note importanti

DATI SOGGETTO:
- subject_tax_id: partita IVA del cliente/fornitore
- subject_address: indirizzo
- subject_city: città
- subject_email: email se presente
- subject_phone: telefono se presente

Rispondi SOLO con i dati trovati. Per le fatture di acquisto (riceviamo), il fornitore è chi emette.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analizza questa fattura e estrai tutti i dati fiscali e contabili.",
              },
              {
                type: "image_url",
                image_url: {
                  url: dataUrl,
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_invoice_data",
              description: "Estrae i dati strutturati dalla fattura",
              parameters: {
                type: "object",
                properties: {
                  invoice_number: {
                    type: "string",
                    description: "Numero della fattura",
                  },
                  invoice_date: {
                    type: "string",
                    description: "Data della fattura in formato YYYY-MM-DD",
                  },
                  invoice_type: {
                    type: "string",
                    enum: ["vendita", "acquisto", "nota_credito"],
                    description: "Tipo di fattura",
                  },
                  subject_name: {
                    type: "string",
                    description: "Nome/ragione sociale del cliente o fornitore",
                  },
                  subject_type: {
                    type: "string",
                    enum: ["cliente", "fornitore"],
                    description: "Tipo di soggetto",
                  },
                  imponibile: {
                    type: "number",
                    description: "Importo imponibile senza IVA",
                  },
                  iva_rate: {
                    type: "number",
                    description: "Aliquota IVA (es: 22, 10, 4, 0)",
                  },
                  iva_amount: {
                    type: "number",
                    description: "Importo IVA",
                  },
                  total_amount: {
                    type: "number",
                    description: "Importo totale",
                  },
                  vat_regime: {
                    type: "string",
                    enum: ["domestica_imponibile", "ue_non_imponibile", "extra_ue", "reverse_charge"],
                    description: "Regime IVA applicato",
                  },
                  due_date: {
                    type: "string",
                    description: "Data scadenza pagamento in formato YYYY-MM-DD",
                  },
                  payment_method: {
                    type: "string",
                    description: "Metodo di pagamento",
                  },
                  notes: {
                    type: "string",
                    description: "Note importanti dalla fattura",
                  },
                  subject_tax_id: {
                    type: "string",
                    description: "Partita IVA del soggetto",
                  },
                  subject_address: {
                    type: "string",
                    description: "Indirizzo del soggetto",
                  },
                  subject_city: {
                    type: "string",
                    description: "Città del soggetto",
                  },
                  subject_email: {
                    type: "string",
                    description: "Email del soggetto",
                  },
                  subject_phone: {
                    type: "string",
                    description: "Telefono del soggetto",
                  },
                  confidence: {
                    type: "string",
                    enum: ["high", "medium", "low"],
                    description: "Livello di confidenza nell'estrazione",
                  },
                },
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_invoice_data" } },
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

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const extractedData = JSON.parse(toolCall.function.arguments);
      console.log("Extracted invoice data:", extractedData);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: extractedData
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const content = data.choices?.[0]?.message?.content;
    console.log("No tool call, content:", content);
    
    return new Response(
      JSON.stringify({ success: true, data: {}, message: "Could not extract structured data" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error analyzing invoice:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
