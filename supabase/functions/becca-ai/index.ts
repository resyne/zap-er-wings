import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

interface BeccaRequest {
  message_id: string;
  conversation_id: string;
  account_id: string;
  message_type: string;
  content: string;
  media_url?: string;
  media_mime_type?: string;
  sender_phone: string;
  authorized_user_id: string;
  allowed_actions: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

    const body: BeccaRequest = await req.json();
    console.log("Becca AI request:", JSON.stringify(body));

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
      console.log("Analyzing image...");
      let imageUrl = body.media_url;

      if (!body.media_url.startsWith("http")) {
        const { data: account } = await supabase
          .from("whatsapp_accounts")
          .select("access_token")
          .eq("id", body.account_id)
          .single();

        if (account?.access_token) {
          const mediaRes = await fetch(`https://graph.facebook.com/v21.0/${body.media_url}`, {
            headers: { "Authorization": `Bearer ${account.access_token}` },
          });
          if (mediaRes.ok) {
            const mediaData = await mediaRes.json();
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
                text: `Analizza questa immagine e descrivi il contenuto in modo dettagliato.
Se è un documento contabile (fattura, scontrino, ricevuta), estrai tutti i dati fiscali.
Se è altro, descrivi cosa vedi.
Rispondi in testo libero, in italiano.`
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

    // Step 3: Get context data for AI
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name, company_name, tax_id")
      .limit(50);

    const customerList = (customers || [])
      .map(c => `${c.name || c.company_name} (ID: ${c.id})`)
      .join("\n");

    // Get Becca settings
    const { data: settings } = await supabase
      .from("becca_settings")
      .select("*")
      .eq("account_id", body.account_id)
      .single();

    const persona = settings?.ai_persona || "Sei Becca, l'assistente AI aziendale di Zapper. Sei efficiente, precisa e professionale.";
    const autoThreshold = settings?.auto_confirm_threshold || 90;

    // Step 4: Classify intent and extract data with AI
    const allowedActionsStr = body.allowed_actions.join(", ");

    const aiPrompt = `${persona}

Sei un'assistente AI che riceve messaggi WhatsApp dal team aziendale e deve classificare l'intento ed estrarre i dati per eseguire azioni nell'ERP.

AZIONI DISPONIBILI: ${allowedActionsStr}

DESCRIZIONE AZIONI:
- prima_nota: Registrare un movimento contabile (entrata/uscita, importo, fornitore/cliente, IVA, metodo pagamento)
- task: Creare un task/promemoria (titolo, descrizione, scadenza, priorità, assegnazione)
- sales_order: Creare un ordine di vendita (cliente, prodotti, importo, note)
- lead: Creare un nuovo lead CRM (nome, azienda, telefono, email, interesse, paese)

CLIENTI/FORNITORI ESISTENTI:
${customerList || "Nessuno in database"}

METODI DI PAGAMENTO VALIDI: contanti, carta, bonifico, anticipo_personale, carta_aziendale, anticipo_dipendente, carta_q8, american_express, banca, banca_intesa, cassa

TESTO DEL MESSAGGIO:
"${textToAnalyze}"

ISTRUZIONI:
1. Classifica l'intento del messaggio tra le azioni disponibili
2. Estrai tutti i dati rilevanti
3. Se non riesci a classificare o mancano dati essenziali, usa "unknown"
4. Genera una domanda di conferma da inviare all'utente

Rispondi ESCLUSIVAMENTE in formato JSON valido:
{
  "action": "prima_nota" | "task" | "sales_order" | "lead" | "unknown",
  "confidence": numero da 0 a 100,
  "data": {
    // Per prima_nota:
    "tipo": "entrata" | "uscita",
    "importo_totale": numero,
    "imponibile": numero | null,
    "iva_aliquota": numero | null,
    "iva_importo": numero | null,
    "regime_iva": "ordinaria_22" | "reverse_charge" | "intracomunitaria" | "extra_ue" | "esente" | "non_soggetta",
    "descrizione": "...",
    "fornitore_cliente_id": "UUID" | null,
    "fornitore_cliente_nome": "...",
    "data_documento": "YYYY-MM-DD",
    "metodo_pagamento": "..." | null,

    // Per task:
    "titolo": "...",
    "descrizione": "...",
    "scadenza": "YYYY-MM-DD" | null,
    "priorita": "low" | "medium" | "high" | "urgent",

    // Per sales_order:
    "cliente_id": "UUID" | null,
    "cliente_nome": "...",
    "prodotti": "...",
    "importo": numero | null,
    "note": "...",

    // Per lead:
    "nome_contatto": "...",
    "azienda": "..." | null,
    "telefono": "..." | null,
    "email": "..." | null,
    "interesse": "...",
    "paese": "..." | null
  },
  "confirmation_message": "Messaggio di conferma da inviare via WhatsApp, con emoji e formattazione WhatsApp (*grassetto*, _corsivo_). Riepiloga cosa hai capito e chiedi conferma. Esempio: '📋 Ho capito che vuoi registrare una *uscita* di €500...\n\nConfermi? Rispondi *Sì* o *No*'",
  "note_ai": "eventuali dubbi o note"
}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: aiPrompt }],
        temperature: 0.2,
        max_tokens: 1500,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`AI Gateway error: ${aiRes.status} - ${errText}`);
    }

    const aiData = await aiRes.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";
    console.log("Becca AI response:", rawContent);

    let parsed;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in AI response");
      }
    } catch (e) {
      throw new Error(`Failed to parse AI response: ${e.message}`);
    }

    const action = parsed.action || "unknown";
    const confidence = parsed.confidence || 0;
    const data = parsed.data || {};
    const confirmationMessage = parsed.confirmation_message || "";

    // Log the activity
    const { data: logEntry } = await supabase.from("becca_activity_log").insert({
      account_id: body.account_id,
      authorized_user_id: body.authorized_user_id,
      conversation_id: body.conversation_id,
      message_id: body.message_id,
      action_type: action,
      intent_detected: action,
      raw_message: textToAnalyze,
      ai_interpretation: parsed,
      confidence_score: confidence,
      confirmation_question: confirmationMessage,
      status: confidence >= autoThreshold ? "completed" : "awaiting_confirmation",
    }).select().single();

    let entityId: string | null = null;
    let entityType: string | null = null;
    let resultMessage = "";

    // If confidence is high enough, auto-execute
    if (confidence >= autoThreshold && action !== "unknown") {
      const result = await executeAction(supabase, action, data, settings);
      entityId = result.entityId;
      entityType = result.entityType;
      resultMessage = result.message;

      // Update log with entity
      if (logEntry) {
        await supabase.from("becca_activity_log").update({
          entity_id: entityId,
          entity_type: entityType,
          status: "completed",
        }).eq("id", logEntry.id);
      }

      // Send confirmation with details
      const finalMessage = `✅ *Becca - Azione completata*\n\n${resultMessage}\n\n_Vuoi modificare qualcosa? Rispondi con le correzioni._`;
      await sendWhatsAppReply(supabaseUrl, supabaseServiceKey, body.account_id, body.conversation_id, finalMessage);
    } else if (action !== "unknown") {
      // Ask for confirmation
      await sendWhatsAppReply(supabaseUrl, supabaseServiceKey, body.account_id, body.conversation_id, confirmationMessage);
    } else {
      // Unknown intent
      const unknownMsg = `🤔 *Becca*\n\nNon ho capito bene cosa vuoi fare. Puoi riformulare?\n\n💡 _Esempi:_\n• "Uscita 500€ fornitore Rossi, fattura"\n• "Ricordami di chiamare Bianchi domani"\n• "Nuovo ordine forno per Mario Verdi 15000€"\n• "Nuovo contatto: Giovanni Neri, tel 333..."`;
      await sendWhatsAppReply(supabaseUrl, supabaseServiceKey, body.account_id, body.conversation_id, unknownMsg);
    }

    return new Response(
      JSON.stringify({ success: true, action, confidence, entity_id: entityId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Becca AI error:", error);

    try {
      const body: BeccaRequest = await req.clone().json().catch(() => ({} as any));
      await supabase.from("becca_activity_log").insert({
        account_id: body.account_id || null,
        authorized_user_id: body.authorized_user_id || null,
        conversation_id: body.conversation_id || null,
        message_id: body.message_id || null,
        action_type: "error",
        raw_message: body.content || null,
        status: "failed",
        error_message: error.message,
      });
    } catch (e) {
      console.error("Failed to log error:", e);
    }

    // Send error message to user
    try {
      const body: BeccaRequest = await req.clone().json().catch(() => ({} as any));
      if (body.conversation_id && body.account_id) {
        await sendWhatsAppReply(supabaseUrl, supabaseServiceKey, body.account_id, body.conversation_id,
          `⚠️ *Becca*\n\nMi dispiace, ho avuto un problema nell'elaborare il tuo messaggio. Riprova tra qualche istante.`);
      }
    } catch (e) { /* ignore */ }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function executeAction(
  supabase: any,
  action: string,
  data: any,
  settings: any
): Promise<{ entityId: string | null; entityType: string | null; message: string }> {
  
  switch (action) {
    case "prima_nota": {
      const dateFormatted = (data.data_documento || new Date().toISOString().split('T')[0]).replace(/-/g, '');
      const prefix = `PN-${dateFormatted}`;
      const { count } = await supabase
        .from('accounting_entries')
        .select('*', { count: 'exact', head: true })
        .like('account_code', `${prefix}-%`);

      const code = `${prefix}-${String((count || 0) + 1).padStart(2, '0')}`;

      const { data: entry, error } = await supabase.from('accounting_entries').insert({
        amount: data.importo_totale || 0,
        direction: data.tipo === 'entrata' ? 'entrata' : 'uscita',
        document_type: 'movimento',
        document_date: data.data_documento || new Date().toISOString().split('T')[0],
        status: 'da_classificare',
        event_type: 'movimento_finanziario',
        financial_status: data.tipo === 'entrata' ? 'incassata' : 'pagata',
        payment_method: data.metodo_pagamento || null,
        note: `[Becca] ${data.descrizione || ''}`,
        cfo_notes: data.note_ai || '',
        attachment_url: '',
        account_code: code,
        economic_subject_id: data.fornitore_cliente_id || null,
        economic_subject_type: data.tipo === 'entrata' ? 'cliente' : 'fornitore',
        imponibile: data.imponibile || null,
        iva_aliquota: data.iva_aliquota || null,
        iva_amount: data.iva_importo || null,
        totale: data.importo_totale || null,
        iva_mode: data.regime_iva || null,
      }).select().single();

      if (error) throw new Error(`Failed to create entry: ${error.message}`);

      return {
        entityId: entry.id,
        entityType: "accounting_entries",
        message: `📋 Codice: *${code}*\n${data.tipo === 'entrata' ? '📥' : '📤'} Tipo: ${data.tipo === 'entrata' ? 'Entrata' : 'Uscita'}\n💰 Importo: €${(data.importo_totale || 0).toFixed(2)}\n${data.imponibile ? `📊 Imponibile: €${data.imponibile.toFixed(2)}\n` : ''}${data.iva_importo ? `🏷️ IVA: €${data.iva_importo.toFixed(2)} (${data.iva_aliquota}%)\n` : ''}📝 ${data.descrizione || 'N/D'}\n${data.fornitore_cliente_nome ? `👤 ${data.fornitore_cliente_nome}\n` : ''}\n⚠️ _Stato: BOZZA - da validare in Prima Nota_`
      };
    }

    case "task": {
      const { data: task, error } = await supabase.from('tasks').insert({
        title: data.titolo || 'Task da Becca',
        description: `[Becca] ${data.descrizione || ''}`,
        priority: data.priorita || 'medium',
        due_date: data.scadenza || null,
        status: 'todo',
        assigned_to: settings?.default_task_assignee || null,
        created_by: settings?.default_task_assignee || null,
      }).select().single();

      if (error) throw new Error(`Failed to create task: ${error.message}`);

      return {
        entityId: task.id,
        entityType: "tasks",
        message: `📋 Task creato: *${data.titolo}*\n${data.descrizione ? `📝 ${data.descrizione}\n` : ''}${data.scadenza ? `📅 Scadenza: ${data.scadenza}\n` : ''}🔴 Priorità: ${data.priorita || 'media'}\n📌 Stato: Da fare`
      };
    }

    case "sales_order": {
      const { data: order, error } = await supabase.from('sales_orders').insert({
        customer_id: data.cliente_id || null,
        customer_name: data.cliente_nome || 'Da definire',
        total_amount: data.importo || 0,
        notes: `[Becca] ${data.note || ''}\nProdotti: ${data.prodotti || 'Da definire'}`,
        status: 'draft',
        order_type: 'odp',
      }).select().single();

      if (error) throw new Error(`Failed to create order: ${error.message}`);

      return {
        entityId: order.id,
        entityType: "sales_orders",
        message: `🛒 Ordine creato: *${order.number || 'N/D'}*\n👤 Cliente: ${data.cliente_nome || 'Da definire'}\n💰 Importo: €${(data.importo || 0).toFixed(2)}\n📝 ${data.prodotti || 'Prodotti da definire'}\n📌 Stato: Bozza`
      };
    }

    case "lead": {
      const { data: lead, error } = await supabase.from('leads').insert({
        contact_name: data.nome_contatto || 'N/D',
        company_name: data.azienda || null,
        phone: data.telefono || null,
        email: data.email || null,
        notes: `[Becca] ${data.interesse || ''}`,
        country: data.paese || null,
        status: 'new',
        pipeline: 'ZAPPER',
        source: 'whatsapp_becca',
      }).select().single();

      if (error) throw new Error(`Failed to create lead: ${error.message}`);

      return {
        entityId: lead.id,
        entityType: "leads",
        message: `👤 Lead creato: *${data.nome_contatto}*\n${data.azienda ? `🏢 ${data.azienda}\n` : ''}${data.telefono ? `📱 ${data.telefono}\n` : ''}${data.email ? `✉️ ${data.email}\n` : ''}${data.interesse ? `💡 Interesse: ${data.interesse}\n` : ''}${data.paese ? `🌍 ${data.paese}\n` : ''}📌 Pipeline: ZAPPER`
      };
    }

    default:
      return { entityId: null, entityType: null, message: "Azione non riconosciuta" };
  }
}

async function sendWhatsAppReply(
  supabaseUrl: string,
  supabaseServiceKey: string,
  accountId: string,
  conversationId: string,
  message: string
) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        account_id: accountId,
        to: null,
        conversation_id: conversationId,
        message: message,
        type: "text",
      }),
    });
  } catch (e) {
    console.error("Failed to send Becca reply:", e);
  }
}
