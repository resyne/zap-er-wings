import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { fileUrl, fileName, fileType, userId } = await req.json();

    if (!fileUrl || !fileName) {
      return new Response(JSON.stringify({ error: "fileUrl and fileName required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch customers list for matching
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name, company_name, vat_number, tax_code, email")
      .limit(500);

    const customerList = (customers || []).map(c => 
      `ID:${c.id} | ${c.company_name || c.name} | P.IVA:${c.vat_number || ''} | CF:${c.tax_code || ''}`
    ).join("\n");

    // For images (JPEG/PNG), use Gemini with image URL
    const isImage = fileType?.startsWith("image/");
    const isXml = fileType === "text/xml" || fileType === "application/xml" || fileName.endsWith(".xml");
    
    let messages: any[];
    
    const systemPrompt = `Sei un esperto contabile italiano. Analizza il documento contabile fornito ed estrai i dati strutturati.

CLIENTI/FORNITORI ESISTENTI NEL SISTEMA:
${customerList}

Devi:
1. Classificare il tipo di documento (fattura_vendita, fattura_acquisto, nota_credito)
2. Estrarre: numero fattura, data, scadenza, importo netto, aliquota IVA, importo IVA, totale
3. Identificare il cliente/fornitore: cerca tra quelli esistenti tramite P.IVA, nome o ragione sociale
4. Se non trovi corrispondenza, fornisci i dati per crearne uno nuovo`;

    if (isImage) {
      messages = [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: [
            { type: "text", text: "Analizza questa fattura/documento contabile e restituisci i dati strutturati." },
            { type: "image_url", image_url: { url: fileUrl } }
          ]
        }
      ];
    } else if (isXml) {
      // Download and pass XML content
      const xmlResp = await fetch(fileUrl);
      const xmlContent = await xmlResp.text();
      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analizza questa fattura elettronica XML:\n\n${xmlContent.substring(0, 15000)}` }
      ];
    } else {
      // PDF - use image_url approach (Gemini supports PDF URLs)
      messages = [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: [
            { type: "text", text: "Analizza questa fattura/documento contabile PDF e restituisci i dati strutturati." },
            { type: "image_url", image_url: { url: fileUrl } }
          ]
        }
      ];
    }

    // Use tool calling to get structured output
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools: [{
          type: "function",
          function: {
            name: "extract_invoice_data",
            description: "Extract structured invoice data from the document",
            parameters: {
              type: "object",
              properties: {
                document_type: { 
                  type: "string", 
                  enum: ["fattura_vendita", "fattura_acquisto", "nota_credito"],
                  description: "Tipo di documento contabile"
                },
                invoice_number: { type: "string", description: "Numero fattura" },
                invoice_date: { type: "string", description: "Data fattura in formato YYYY-MM-DD" },
                due_date: { type: "string", description: "Data scadenza in formato YYYY-MM-DD (null se non presente)" },
                net_amount: { type: "number", description: "Importo imponibile netto" },
                vat_rate: { type: "number", description: "Aliquota IVA percentuale (es. 22)" },
                vat_amount: { type: "number", description: "Importo IVA" },
                total_amount: { type: "number", description: "Totale documento" },
                counterpart_name: { type: "string", description: "Nome/ragione sociale del cliente o fornitore" },
                counterpart_vat: { type: "string", description: "P.IVA del cliente o fornitore" },
                counterpart_address: { type: "string", description: "Indirizzo del cliente o fornitore" },
                matched_customer_id: { type: "string", description: "ID UUID del cliente esistente se trovata corrispondenza, null altrimenti" },
                confidence: { type: "number", description: "Confidenza dell'analisi da 0 a 1" },
                needs_new_customer: { type: "boolean", description: "True se il cliente/fornitore non è stato trovato tra quelli esistenti" },
                new_customer_data: {
                  type: "object",
                  description: "Dati per creare un nuovo cliente (solo se needs_new_customer=true)",
                  properties: {
                    name: { type: "string" },
                    company_name: { type: "string" },
                    vat_number: { type: "string" },
                    address: { type: "string" },
                    email: { type: "string" }
                  }
                }
              },
              required: ["document_type", "invoice_number", "total_amount", "counterpart_name", "confidence"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "extract_invoice_data" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Troppi tentativi. Riprova tra qualche secondo." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti. Ricarica i crediti del workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("No structured output from AI");
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    // If customer needs to be created, do it
    let customerId = extracted.matched_customer_id;
    let customerCreated = false;
    
    if (extracted.needs_new_customer && extracted.new_customer_data) {
      const newCust = extracted.new_customer_data;
      const { data: newCustomer, error: custError } = await supabase
        .from("customers")
        .insert({
          name: newCust.name || extracted.counterpart_name,
          company_name: newCust.company_name || extracted.counterpart_name,
          vat_number: newCust.vat_number || extracted.counterpart_vat,
          address: newCust.address || extracted.counterpart_address,
          email: newCust.email,
          is_active: true,
        })
        .select("id")
        .single();

      if (newCustomer) {
        customerId = newCustomer.id;
        customerCreated = true;
      } else {
        console.error("Error creating customer:", custError);
      }
    }

    // Save the document record
    const { data: doc, error: docError } = await supabase
      .from("accounting_documents")
      .insert({
        document_type: extracted.document_type,
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        invoice_number: extracted.invoice_number,
        invoice_date: extracted.invoice_date || null,
        due_date: extracted.due_date || null,
        net_amount: extracted.net_amount || null,
        vat_rate: extracted.vat_rate || null,
        vat_amount: extracted.vat_amount || null,
        total_amount: extracted.total_amount || null,
        customer_id: customerId || null,
        counterpart_name: extracted.counterpart_name,
        counterpart_vat: extracted.counterpart_vat || null,
        counterpart_address: extracted.counterpart_address || null,
        ai_confidence: extracted.confidence || null,
        ai_raw_data: extracted,
        status: "pending",
        uploaded_by: userId || null,
      })
      .select()
      .single();

    if (docError) {
      console.error("Error saving document:", docError);
      throw new Error("Failed to save document");
    }

    return new Response(JSON.stringify({
      success: true,
      document: doc,
      extracted,
      customerCreated,
      customerId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("analyze-accounting-document error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
