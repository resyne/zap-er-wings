import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fileToDataUrl(url: string): Promise<{ dataUrl: string; mimeType: string }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch file: ${response.status}`);
  const contentType = response.headers.get("content-type") || "application/octet-stream";
  const arrayBuffer = await response.arrayBuffer();
  const base64 = base64Encode(new Uint8Array(arrayBuffer));
  return { dataUrl: `data:${contentType};base64,${base64}`, mimeType: contentType };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageUrl, fileType, fileName } = await req.json();
    if (!imageUrl) {
      return new Response(JSON.stringify({ success: false, error: "URL is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch existing customers and suppliers for fuzzy matching
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const [{ data: customers }, { data: suppliers }] = await Promise.all([
      supabase.from("customers").select("id, name, company_name, vat_number, tax_code, email, phone, address").limit(500),
      supabase.from("suppliers").select("id, name, email, tax_id, phone, address").limit(500),
    ]);

    const customerList = (customers || []).map(c =>
      `CLIENTE ID:${c.id} | ${c.company_name || c.name} | P.IVA:${c.vat_number || ''} | CF:${c.tax_code || ''}`
    ).join("\n");

    const supplierList = (suppliers || []).map(s =>
      `FORNITORE ID:${s.id} | ${s.name} | P.IVA:${s.tax_id || ''}`
    ).join("\n");

    const isXml = fileType === "text/xml" || fileType === "application/xml" ||
      (fileName || "").toLowerCase().endsWith(".xml") ||
      (fileName || "").toLowerCase().endsWith(".p7m");

    console.log("Analyzing invoice:", imageUrl, "isXml:", isXml);

    const systemPrompt = `Sei un assistente specializzato nell'analisi di fatture italiane (fatture di vendita, fatture di acquisto, note di credito).

LA NOSTRA AZIENDA È: "CLIMATEL di ELEFANTE PASQUALE" (P.IVA 03895390650) e varianti (CLIMATEL, Climatel di Elefante Pasquale, ecc.)
Usa questa informazione per classificare il documento:
- Se CLIMATEL è il CEDENTE/PRESTATORE → fattura_vendita (controparte = cliente)
- Se CLIMATEL è il CESSIONARIO/COMMITTENTE → fattura_acquisto (controparte = fornitore)
- Se è una nota di credito → nota_credito

CLIENTI E FORNITORI ESISTENTI:
${customerList}
---
${supplierList}

IMPORTANTE: Cerca la CONTROPARTE (chi NON è CLIMATEL) tra i clienti/fornitori esistenti confrontando P.IVA, Codice Fiscale o ragione sociale. Se trovi corrispondenza, restituisci l'ID. Altrimenti fornisci i dati completi per crearne uno nuovo.

ESTRAI SEMPRE LE DUE PARTI:
- supplier_* = Cedente/Prestatore (chi emette)
- customer_* = Cessionario/Committente (destinatario)`;

    let messages: any[];

    if (isXml) {
      // Parse XML content directly
      const xmlResp = await fetch(imageUrl);
      const xmlContent = await xmlResp.text();
      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analizza questa fattura elettronica XML ed estrai tutti i dati fiscali e contabili:\n\n${xmlContent.substring(0, 20000)}` },
      ];
    } else {
      // Image or PDF preview - use vision
      const { dataUrl, mimeType } = await fileToDataUrl(imageUrl);
      const isPdf = mimeType === "application/pdf" || (imageUrl || "").toLowerCase().endsWith(".pdf");
      messages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Analizza questa fattura e estrai tutti i dati fiscali e contabili." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ];
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
        tools: [{
          type: "function",
          function: {
            name: "extract_invoice_data",
            description: "Estrae i dati strutturati dalla fattura con matching anagrafico",
            parameters: {
              type: "object",
              properties: {
                invoice_number: { type: "string", description: "Numero della fattura" },
                invoice_date: { type: "string", description: "Data fattura YYYY-MM-DD" },
                invoice_type: { type: "string", enum: ["vendita", "acquisto", "nota_credito"], description: "Tipo di documento" },
                imponibile: { type: "number", description: "Importo imponibile senza IVA" },
                iva_rate: { type: "number", description: "Aliquota IVA (es: 22, 10, 4, 0)" },
                iva_amount: { type: "number", description: "Importo IVA" },
                total_amount: { type: "number", description: "Importo totale" },
                vat_regime: { type: "string", enum: ["domestica_imponibile", "ue_non_imponibile", "extra_ue", "reverse_charge"] },
                due_date: { type: "string", description: "Data scadenza pagamento YYYY-MM-DD" },
                payment_method: { type: "string", enum: ["bonifico", "carta", "contanti", "assegno", "pos"] },
                payment_terms: { type: "string", description: "Termini pagamento (es: 30gg)" },
                notes: { type: "string", description: "Note importanti" },
                expense_category: { type: "string", enum: ["carburante", "pedaggi", "materiali", "servizi", "consulenza", "utenze", "affitto", "manutenzione", "assicurazioni", "formazione", "marketing", "trasporti", "altro"] },
                cost_center_hint: { type: "string", enum: ["produzione", "amministrazione", "commerciale", "logistica", "assistenza", "direzione"] },
                account_hint: { type: "string", description: "Nome conto contabile suggerito" },
                invoice_description: { type: "string", description: "Descrizione/oggetto principale" },

                // Cedente/Prestatore
                supplier_name: { type: "string", description: "Ragione sociale Cedente/Prestatore" },
                supplier_tax_id: { type: "string", description: "P.IVA Cedente/Prestatore" },
                supplier_fiscal_code: { type: "string", description: "Codice Fiscale Cedente/Prestatore" },
                supplier_address: { type: "string", description: "Indirizzo completo Cedente/Prestatore" },
                supplier_city: { type: "string", description: "Città Cedente/Prestatore" },
                supplier_email: { type: "string", description: "Email Cedente/Prestatore" },
                supplier_phone: { type: "string", description: "Telefono Cedente/Prestatore" },
                supplier_pec: { type: "string", description: "PEC Cedente/Prestatore" },
                supplier_sdi_code: { type: "string", description: "Codice SDI Cedente/Prestatore" },

                // Cessionario/Committente
                customer_name: { type: "string", description: "Ragione sociale Cessionario/Committente" },
                customer_tax_id: { type: "string", description: "P.IVA Cessionario/Committente" },
                customer_fiscal_code: { type: "string", description: "CF Cessionario/Committente" },
                customer_address: { type: "string", description: "Indirizzo Cessionario/Committente" },
                customer_city: { type: "string", description: "Città Cessionario/Committente" },
                customer_email: { type: "string", description: "Email Cessionario/Committente" },
                customer_phone: { type: "string", description: "Telefono Cessionario/Committente" },
                customer_pec: { type: "string", description: "PEC Cessionario/Committente" },

                // Matching anagrafico
                matched_subject_id: { type: "string", description: "UUID del cliente/fornitore esistente se trovato, null altrimenti" },
                matched_subject_type: { type: "string", enum: ["cliente", "fornitore"], description: "Tipo del soggetto matchato" },
                needs_new_subject: { type: "boolean", description: "True se la controparte non è stata trovata tra quelli esistenti" },

                confidence: { type: "string", enum: ["high", "medium", "low"] },
              },
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_invoice_data" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ success: false, error: "Rate limit exceeded, riprova tra qualche secondo." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ success: false, error: "Crediti AI esauriti." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ success: false, error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ success: true, data: {}, message: "Could not extract structured data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);
    console.log("Extracted invoice data:", extracted);

    // Sanitize: AI sometimes returns "None" or "null" strings instead of actual null
    if (extracted.matched_subject_id && (extracted.matched_subject_id === "None" || extracted.matched_subject_id === "null" || extracted.matched_subject_id === "none")) {
      extracted.matched_subject_id = null;
      extracted.needs_new_subject = true;
    }

    // Auto-create or update subject if needed
    let subjectResult = null;
    if (extracted.matched_subject_id) {
      // Update existing subject with any new info from the invoice
      const isCustomer = extracted.matched_subject_type === "cliente";
      const table = isCustomer ? "customers" : "suppliers";

      // Build update payload with non-null new data
      const updatePayload: Record<string, any> = {};
      const counterpart = extracted.invoice_type === "vendita"
        ? { name: extracted.customer_name, tax_id: extracted.customer_tax_id, email: extracted.customer_email, phone: extracted.customer_phone, address: extracted.customer_address }
        : { name: extracted.supplier_name, tax_id: extracted.supplier_tax_id, email: extracted.supplier_email, phone: extracted.supplier_phone, address: extracted.supplier_address };

      if (isCustomer) {
        if (counterpart.email) updatePayload.email = counterpart.email;
        if (counterpart.phone) updatePayload.phone = counterpart.phone;
        if (counterpart.address) updatePayload.address = counterpart.address;
        if (counterpart.tax_id) updatePayload.vat_number = counterpart.tax_id;
      } else {
        if (counterpart.email) updatePayload.email = counterpart.email;
        if (counterpart.phone) updatePayload.phone = counterpart.phone;
        if (counterpart.address) updatePayload.address = counterpart.address;
        if (counterpart.tax_id) updatePayload.tax_id = counterpart.tax_id;
      }

      if (Object.keys(updatePayload).length > 0) {
        await supabase.from(table).update(updatePayload).eq("id", extracted.matched_subject_id);
        console.log(`Updated ${table} ${extracted.matched_subject_id}:`, updatePayload);
      }

      subjectResult = { id: extracted.matched_subject_id, type: extracted.matched_subject_type, action: "matched" };

    } else if (extracted.needs_new_subject) {
      // Create new customer or supplier
      const isVendita = extracted.invoice_type === "vendita";
      // If it's a sale, counterpart is customer; if purchase, counterpart is supplier
      const counterpart = isVendita
        ? { name: extracted.customer_name, tax_id: extracted.customer_tax_id, fiscal_code: extracted.customer_fiscal_code, email: extracted.customer_email, phone: extracted.customer_phone, address: extracted.customer_address, pec: extracted.customer_pec }
        : { name: extracted.supplier_name, tax_id: extracted.supplier_tax_id, fiscal_code: extracted.supplier_fiscal_code, email: extracted.supplier_email, phone: extracted.supplier_phone, address: extracted.supplier_address, pec: extracted.supplier_pec };

      if (isVendita) {
        // Create customer
        const { data: newCust, error } = await supabase.from("customers").insert({
          name: counterpart.name || "Nuovo Cliente",
          company_name: counterpart.name,
          vat_number: counterpart.tax_id || null,
          tax_code: counterpart.fiscal_code || null,
          email: counterpart.email || null,
          phone: counterpart.phone || null,
          address: counterpart.address || null,
          is_active: true,
        }).select("id, name").single();

        if (newCust) {
          subjectResult = { id: newCust.id, type: "cliente", action: "created", name: newCust.name };
          console.log("Created new customer:", newCust);
        } else {
          console.error("Error creating customer:", error);
        }
      } else {
        // Create supplier
        const code = `FOR-${Date.now().toString().slice(-6)}`;
        const { data: newSup, error } = await supabase.from("suppliers").insert({
          name: counterpart.name || "Nuovo Fornitore",
          code,
          tax_id: counterpart.tax_id || null,
          email: counterpart.email || null,
          phone: counterpart.phone || null,
          address: counterpart.address || null,
          is_active: true,
        }).select("id, name").single();

        if (newSup) {
          subjectResult = { id: newSup.id, type: "fornitore", action: "created", name: newSup.name };
          console.log("Created new supplier:", newSup);
        } else {
          console.error("Error creating supplier:", error);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: extracted,
      subjectResult,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error analyzing invoice:", error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
