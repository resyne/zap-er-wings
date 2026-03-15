import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

interface PrimaNotaRequest {
  message_id: string;
  conversation_id: string;
  account_id: string;
  message_type: string; // text, image, audio
  content: string;
  media_url?: string;
  media_mime_type?: string;
  config_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    const body: PrimaNotaRequest = await req.json();
    console.log("Prima Nota WhatsApp request:", JSON.stringify(body));

    let textToAnalyze = body.content || "";

    // Step 1: If audio, transcribe first
    if (body.message_type === "audio" && body.media_url) {
      console.log("Transcribing audio message...");
      const transcribeRes = await fetch(`${supabaseUrl}/functions/v1/transcribe-whatsapp-audio`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audio_url: body.media_url,
          message_id: body.message_id,
        }),
      });

      if (transcribeRes.ok) {
        const transcribeData = await transcribeRes.json();
        textToAnalyze = transcribeData.transcription || transcribeData.translated_text || "";
        console.log("Transcription:", textToAnalyze);
      } else {
        throw new Error("Failed to transcribe audio");
      }
    }

    // Step 2: If image, analyze with AI vision
    if (body.message_type === "image" && body.media_url) {
      console.log("Analyzing image for accounting data...");
      
      // Download media first via whatsapp-download-media
      let imageUrl = body.media_url;
      
      // If it's a Meta media ID, download it first
      if (!body.media_url.startsWith("http")) {
        // Get the account's access token
        const { data: account } = await supabase
          .from("whatsapp_accounts")
          .select("access_token")
          .eq("id", body.account_id)
          .single();

        if (account?.access_token) {
          // Get media URL from Meta
          const mediaRes = await fetch(`https://graph.facebook.com/v21.0/${body.media_url}`, {
            headers: { "Authorization": `Bearer ${account.access_token}` },
          });
          if (mediaRes.ok) {
            const mediaData = await mediaRes.json();
            // Download actual file
            const fileRes = await fetch(mediaData.url, {
              headers: { "Authorization": `Bearer ${account.access_token}` },
            });
            if (fileRes.ok) {
              const fileBuffer = await fileRes.arrayBuffer();
              const base64 = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));
              imageUrl = `data:${body.media_mime_type || 'image/jpeg'};base64,${base64}`;
            }
          }
        }
      }

      // Use Gemini vision to analyze the image
      const visionRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{
            role: "user",
            content: [
              {
                type: "text",
                text: `Analizza questa immagine di un documento contabile (fattura, scontrino, ricevuta).
Estrai le seguenti informazioni e rispondi SOLO in formato JSON:
{
  "tipo": "entrata" o "uscita",
  "importo_totale": numero (il totale documento),
  "imponibile": numero o null,
  "iva_aliquota": numero o null (es. 22),
  "iva_importo": numero o null,
  "regime_iva": "ordinaria_22" o "reverse_charge" o "intracomunitaria" o "extra_ue" o "esente" o "non_soggetta",
  "descrizione": "breve descrizione del movimento",
  "fornitore_cliente": "nome del fornitore o cliente",
  "data_documento": "YYYY-MM-DD" o null,
  "metodo_pagamento": "contanti" o "carta" o "bonifico" o "carta_aziendale" o null,
  "numero_documento": "numero fattura/ricevuta" o null
}`
              },
              {
                type: "image_url",
                image_url: { url: imageUrl }
              }
            ]
          }],
          temperature: 0.2,
          max_tokens: 1000,
        }),
      });

      if (visionRes.ok) {
        const visionData = await visionRes.json();
        textToAnalyze = visionData.choices?.[0]?.message?.content || "";
        console.log("Vision analysis:", textToAnalyze);
      } else {
        throw new Error("Failed to analyze image");
      }
    }

    // Step 3: Parse text into accounting entry with AI
    console.log("Parsing text for Prima Nota:", textToAnalyze);

    // Get list of existing customers/suppliers for matching
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name, company_name, tax_id")
      .limit(100);

    const customerList = (customers || [])
      .map(c => `${c.name || c.company_name} (ID: ${c.id})`)
      .join("\n");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: `Sei un contabile esperto. Analizza il seguente messaggio/testo e crea un movimento di Prima Nota.

TESTO DA ANALIZZARE:
${textToAnalyze}

CLIENTI/FORNITORI ESISTENTI (cerca di associare se possibile):
${customerList || "Nessun cliente/fornitore in database"}

METODI DI PAGAMENTO VALIDI: contanti, carta, bonifico, anticipo_personale, carta_aziendale, anticipo_dipendente, carta_q8, american_express, banca, banca_intesa, cassa

REGIMI IVA VALIDI: ordinaria_22, reverse_charge, intracomunitaria, extra_ue, esente, non_soggetta

Rispondi ESCLUSIVAMENTE in formato JSON valido:
{
  "tipo": "entrata" o "uscita",
  "importo_totale": numero (totale documento, IVA inclusa),
  "imponibile": numero o null,
  "iva_aliquota": numero o null (es. 22),
  "iva_importo": numero o null,
  "regime_iva": "ordinaria_22" | "reverse_charge" | "intracomunitaria" | "extra_ue" | "esente" | "non_soggetta",
  "descrizione": "descrizione del movimento",
  "fornitore_cliente_id": "UUID se trovato tra quelli esistenti" o null,
  "fornitore_cliente_nome": "nome del fornitore/cliente",
  "data_documento": "YYYY-MM-DD",
  "metodo_pagamento": stringa dal set valido o null,
  "confidenza": numero da 0 a 100,
  "note_ai": "eventuali note o dubbi sull'interpretazione"
}`
        }],
        temperature: 0.2,
        max_tokens: 1000,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`AI Gateway error: ${aiRes.status} - ${errText}`);
    }

    const aiData = await aiRes.json();
    const rawAiContent = aiData.choices?.[0]?.message?.content || "";
    console.log("AI interpretation:", rawAiContent);

    // Parse AI response
    let parsed;
    try {
      const jsonMatch = rawAiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in AI response");
      }
    } catch (e) {
      throw new Error(`Failed to parse AI response: ${e.message}`);
    }

    // Step 4: Create the accounting entry
    const dateFormatted = (parsed.data_documento || new Date().toISOString().split('T')[0]).replace(/-/g, '');
    const prefix = `PN-${dateFormatted}`;
    const { count } = await supabase
      .from('accounting_entries')
      .select('*', { count: 'exact', head: true })
      .like('account_code', `${prefix}-%`);
    
    const code = `${prefix}-${String((count || 0) + 1).padStart(2, '0')}`;

    const entryData = {
      amount: parsed.importo_totale || 0,
      direction: parsed.tipo === 'entrata' ? 'entrata' : 'uscita',
      document_type: 'movimento',
      document_date: parsed.data_documento || new Date().toISOString().split('T')[0],
      status: 'bozza', // Always as draft for review
      event_type: 'movimento_finanziario',
      financial_status: parsed.tipo === 'entrata' ? 'incassata' : 'pagata',
      payment_method: parsed.metodo_pagamento || null,
      note: `[WhatsApp] ${parsed.descrizione || ''}`,
      cfo_notes: parsed.note_ai || `Confidenza AI: ${parsed.confidenza || 0}%`,
      attachment_url: '',
      account_code: code,
      economic_subject_id: parsed.fornitore_cliente_id || null,
      economic_subject_type: parsed.tipo === 'entrata' ? 'cliente' : 'fornitore',
      imponibile: parsed.imponibile || null,
      iva_aliquota: parsed.iva_aliquota || null,
      iva_amount: parsed.iva_importo || null,
      totale: parsed.importo_totale || null,
      iva_mode: parsed.regime_iva || null,
    };

    const { data: newEntry, error: entryError } = await supabase
      .from('accounting_entries')
      .insert(entryData)
      .select()
      .single();

    if (entryError) {
      throw new Error(`Failed to create entry: ${entryError.message}`);
    }

    // Step 5: Log the operation
    await supabase.from('whatsapp_prima_nota_log').insert({
      config_id: body.config_id,
      message_id: body.message_id,
      conversation_id: body.conversation_id,
      accounting_entry_id: newEntry.id,
      raw_message: textToAnalyze,
      ai_interpretation: parsed,
      status: 'completed',
    });

    // Step 6: Send confirmation reply via WhatsApp
    const confirmMsg = `✅ *Movimento registrato in Prima Nota*\n\n` +
      `📋 Codice: ${code}\n` +
      `${parsed.tipo === 'entrata' ? '📥' : '📤'} Tipo: ${parsed.tipo === 'entrata' ? 'Entrata' : 'Uscita'}\n` +
      `💰 Importo: €${(parsed.importo_totale || 0).toFixed(2)}\n` +
      `${parsed.imponibile ? `📊 Imponibile: €${parsed.imponibile.toFixed(2)}\n` : ''}` +
      `${parsed.iva_importo ? `🏷️ IVA: €${parsed.iva_importo.toFixed(2)} (${parsed.iva_aliquota}%)\n` : ''}` +
      `📝 ${parsed.descrizione || 'N/D'}\n` +
      `${parsed.fornitore_cliente_nome ? `👤 ${parsed.fornitore_cliente_nome}\n` : ''}` +
      `\n⚠️ _Stato: BOZZA - da validare in Prima Nota_`;

    // Send reply back to the conversation
    try {
      await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseServiceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          account_id: body.account_id,
          to: null, // Will need conversation phone
          conversation_id: body.conversation_id,
          message: confirmMsg,
          type: "text",
        }),
      });
    } catch (e) {
      console.error("Failed to send confirmation:", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        entry_id: newEntry.id,
        code: code,
        parsed: parsed,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Prima Nota processing error:", error);

    // Log the failure
    try {
      const body: PrimaNotaRequest = await req.clone().json().catch(() => ({} as any));
      await supabase.from('whatsapp_prima_nota_log').insert({
        config_id: body.config_id || null,
        message_id: body.message_id || null,
        conversation_id: body.conversation_id || null,
        raw_message: body.content || null,
        status: 'failed',
        error_message: error.message,
      });
    } catch (e) {
      console.error("Failed to log error:", e);
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
