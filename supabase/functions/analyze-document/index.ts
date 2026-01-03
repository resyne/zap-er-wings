import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to convert file to base64 data URL
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

    console.log("Analyzing document:", imageUrl);

    // Convert file to base64 data URL
    const { dataUrl, mimeType } = await fileToDataUrl(imageUrl);
    console.log("Converted to data URL, MIME type:", mimeType);
    
    // Determine if it's a PDF - use OpenAI for PDFs, Gemini for images
    const isPdf = mimeType === "application/pdf" || imageUrl.toLowerCase().endsWith(".pdf");
    const model = isPdf ? "openai/gpt-5-mini" : "google/gemini-2.5-flash";
    console.log("Using model:", model, "isPdf:", isPdf);

    const systemPrompt = `Sei un assistente specializzato nell'analisi di documenti contabili italiani (fatture, scontrini, ricevute, estratti conto, rapporti di intervento, DDT).

Analizza l'immagine del documento e estrai i seguenti dati se presenti:

DATI DOCUMENTO:
- direction: "entrata" se è un incasso/vendita, "uscita" se è una spesa/acquisto
- document_type: uno tra "fattura", "scontrino", "estratto_conto", "documento_interno", "rapporto_intervento", "ddt", "altro"
- document_number: numero del documento (es. numero DDT, numero fattura)
- amount: l'importo totale in formato numerico (es: 150.50)
- document_date: la data del documento in formato YYYY-MM-DD
- payment_method: uno tra "contanti", "carta", "bonifico", "anticipo_personale", "non_so" (se identificabile)
- subject_type: uno tra "cliente", "fornitore", "interno" (se identificabile)
- transport_reason: causale del trasporto (per DDT: vendita, c/visione, c/lavorazione, reso, etc.)
- notes: eventuali note o dettagli importanti estratti dal documento

DATI FORNITORE/MITTENTE (chi emette/spedisce):
- supplier_name: ragione sociale o nome del fornitore/emittente
- supplier_tax_id: partita IVA o codice fiscale del fornitore (formato italiano)
- supplier_address: indirizzo completo del fornitore
- supplier_city: città del fornitore
- supplier_email: email del fornitore se presente
- supplier_phone: telefono del fornitore se presente

DATI DESTINATARIO (chi riceve, per DDT):
- recipient_name: ragione sociale o nome del destinatario
- recipient_tax_id: partita IVA o codice fiscale del destinatario
- recipient_address: indirizzo completo del destinatario
- recipient_city: città del destinatario

DATI DESTINAZIONE (luogo di consegna, se diverso dal destinatario):
- destination_name: nome/ragione sociale della destinazione
- destination_address: indirizzo completo della destinazione
- destination_city: città della destinazione

RIGHE/ELEMENTI (per DDT e fatture - estrai tutte le righe):
- line_items: array di oggetti con { description, quantity, unit, unit_price, total }
  - description: descrizione articolo/prodotto
  - quantity: quantità numerica
  - unit: unità di misura (pz, kg, m, n, etc.)
  - unit_price: prezzo unitario (se presente)
  - total: totale riga (se presente)

Rispondi SOLO con i dati trovati, lasciando vuoti i campi non identificabili.
Per le fatture di acquisto (uscita), il fornitore è chi emette la fattura.`;

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
                text: "Analizza questo documento e estrai i dati contabili e del fornitore/emittente.",
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
              name: "extract_document_data",
              description: "Estrae i dati strutturati dal documento contabile inclusi i dati del fornitore, destinatario e righe",
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
                    enum: ["fattura", "scontrino", "estratto_conto", "documento_interno", "rapporto_intervento", "ddt", "altro"],
                    description: "Tipo di documento",
                  },
                  document_number: {
                    type: "string",
                    description: "Numero del documento (DDT, fattura, etc.)",
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
                  transport_reason: {
                    type: "string",
                    description: "Causale del trasporto per DDT (vendita, c/visione, c/lavorazione, reso, etc.)",
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
                  // Supplier/Sender data
                  supplier_name: {
                    type: "string",
                    description: "Ragione sociale o nome del fornitore/emittente/mittente",
                  },
                  supplier_tax_id: {
                    type: "string",
                    description: "Partita IVA o codice fiscale del fornitore",
                  },
                  supplier_address: {
                    type: "string",
                    description: "Indirizzo completo del fornitore",
                  },
                  supplier_city: {
                    type: "string",
                    description: "Città del fornitore",
                  },
                  supplier_email: {
                    type: "string",
                    description: "Email del fornitore",
                  },
                  supplier_phone: {
                    type: "string",
                    description: "Telefono del fornitore",
                  },
                  // Recipient data
                  recipient_name: {
                    type: "string",
                    description: "Ragione sociale o nome del destinatario",
                  },
                  recipient_tax_id: {
                    type: "string",
                    description: "Partita IVA o codice fiscale del destinatario",
                  },
                  recipient_address: {
                    type: "string",
                    description: "Indirizzo completo del destinatario",
                  },
                  recipient_city: {
                    type: "string",
                    description: "Città del destinatario",
                  },
                  // Destination data
                  destination_name: {
                    type: "string",
                    description: "Nome/ragione sociale della destinazione (se diversa dal destinatario)",
                  },
                  destination_address: {
                    type: "string",
                    description: "Indirizzo completo della destinazione",
                  },
                  destination_city: {
                    type: "string",
                    description: "Città della destinazione",
                  },
                  // Line items
                  line_items: {
                    type: "array",
                    description: "Righe/elementi del documento (articoli, prodotti)",
                    items: {
                      type: "object",
                      properties: {
                        description: {
                          type: "string",
                          description: "Descrizione articolo/prodotto",
                        },
                        quantity: {
                          type: "number",
                          description: "Quantità",
                        },
                        unit: {
                          type: "string",
                          description: "Unità di misura (pz, kg, m, n, etc.)",
                        },
                        unit_price: {
                          type: "number",
                          description: "Prezzo unitario",
                        },
                        total: {
                          type: "number",
                          description: "Totale riga",
                        },
                      },
                    },
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
      
      // If we have supplier data, try to match or suggest creation
      let supplierMatch = null;
      if (extractedData.supplier_tax_id || extractedData.supplier_name) {
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const supabase = createClient(supabaseUrl, supabaseKey);
          
          // Try to find existing supplier by tax_id first (most reliable)
          if (extractedData.supplier_tax_id) {
            const { data: supplierByTaxId } = await supabase
              .from("suppliers")
              .select("id, name, code, tax_id, email, phone, address, city")
              .eq("tax_id", extractedData.supplier_tax_id)
              .eq("active", true)
              .limit(1)
              .single();
            
            if (supplierByTaxId) {
              console.log("Found supplier by tax_id:", supplierByTaxId.name);
              supplierMatch = {
                matched: true,
                supplier: supplierByTaxId,
                match_type: "tax_id"
              };
            }
          }
          
          // If no match by tax_id, try by name (fuzzy match)
          if (!supplierMatch && extractedData.supplier_name) {
            const { data: suppliersByName } = await supabase
              .from("suppliers")
              .select("id, name, code, tax_id, email, phone, address, city")
              .ilike("name", `%${extractedData.supplier_name}%`)
              .eq("active", true)
              .limit(5);
            
            if (suppliersByName && suppliersByName.length > 0) {
              console.log("Found potential suppliers by name:", suppliersByName.length);
              supplierMatch = {
                matched: true,
                supplier: suppliersByName[0],
                alternatives: suppliersByName.slice(1),
                match_type: "name_fuzzy"
              };
            }
          }
          
          // No match found - suggest new supplier data
          if (!supplierMatch && (extractedData.supplier_name || extractedData.supplier_tax_id)) {
            console.log("No supplier match, suggesting new supplier");
            supplierMatch = {
              matched: false,
              suggested_supplier: {
                name: extractedData.supplier_name || "",
                tax_id: extractedData.supplier_tax_id || "",
                address: extractedData.supplier_address || "",
                city: extractedData.supplier_city || "",
                email: extractedData.supplier_email || "",
                phone: extractedData.supplier_phone || "",
              }
            };
          }
        } catch (dbError) {
          console.error("Error matching supplier:", dbError);
          // Continue without supplier match
        }
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: extractedData,
          supplier: supplierMatch 
        }),
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
