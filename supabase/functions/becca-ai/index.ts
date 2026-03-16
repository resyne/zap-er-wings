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
        body: JSON.stringify({ audio_url: body.media_url, message_id: body.message_id }),
      });
      if (transcribeRes.ok) {
        const transcribeData = await transcribeRes.json();
        textToAnalyze = transcribeData.transcription || transcribeData.translated_text || "";
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
          .from("whatsapp_accounts").select("access_token").eq("id", body.account_id).single();
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
        headers: { "Authorization": `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{
            role: "user",
            content: [
              { type: "text", text: "Analizza questa immagine e descrivi il contenuto in modo dettagliato. Se è un documento contabile (fattura, scontrino, ricevuta), estrai tutti i dati fiscali. Rispondi in italiano." },
              { type: "image_url", image_url: { url: imageUrl } }
            ]
          }],
          temperature: 0.2, max_tokens: 1000,
        }),
      });
      if (visionRes.ok) {
        const visionData = await visionRes.json();
        textToAnalyze = visionData.choices?.[0]?.message?.content || "";
      } else { throw new Error("Failed to analyze image"); }
    }

    // Step 3: Fetch comprehensive ERP context data in parallel
    const [
      customersRes, leadsRes, tasksRes, ordersRes, commesseRes, commessaPhasesRes, conversationHistory, settingsRes
    ] = await Promise.all([
      supabase.from("customers").select("id, name, company_name, tax_id, email, phone").limit(100),
      supabase.from("leads").select("id, contact_name, company_name, email, phone, status, pipeline, value, source, notes, assigned_to, country, created_at").order("created_at", { ascending: false }).limit(50),
      supabase.from("tasks").select("id, title, description, status, priority, due_date, assigned_to, category, created_at").order("created_at", { ascending: false }).limit(30),
      supabase.from("sales_orders").select("id, number, customer_name, total_amount, status, order_type, notes, created_at").order("created_at", { ascending: false }).limit(30),
      supabase.from("commesse").select("id, number, title, status, type, priority, deadline, customer_id, shipping_city, shipping_province, shipping_address, article, description, created_at, customers(name, company_name)").order("created_at", { ascending: false }).limit(30),
      supabase.from("commessa_phases").select("id, commessa_id, phase_type, phase_order, status, scheduled_date, started_date, completed_date, assigned_to, notes").order("phase_order", { ascending: true }).limit(100),
      supabase.from("whatsapp_messages").select("direction, content, message_type, created_at").eq("conversation_id", body.conversation_id).order("created_at", { ascending: false }).limit(20),
      supabase.from("becca_settings").select("*").eq("account_id", body.account_id).single(),
    ]);

    const customers = customersRes.data || [];
    const leads = leadsRes.data || [];
    const tasks = tasksRes.data || [];
    const orders = ordersRes.data || [];
    const commesse = commesseRes.data || [];
    const commessaPhases = commessaPhasesRes.data || [];
    const history = (conversationHistory.data || []).reverse();
    const settings = settingsRes.data;

    const persona = settings?.ai_persona || "Sei Becca, l'assistente AI aziendale di Zapper. Sei efficiente, precisa e professionale.";
    const autoThreshold = settings?.auto_confirm_threshold || 90;

    // Build ERP context strings
    const customerList = customers.map(c => `- ${c.name || c.company_name} (ID: ${c.id}${c.email ? `, email: ${c.email}` : ''}${c.phone ? `, tel: ${c.phone}` : ''})`).join("\n");

    const leadList = leads.slice(0, 20).map(l => `- ${l.contact_name || 'N/D'}${l.company_name ? ` @ ${l.company_name}` : ''} | Status: ${l.status} | Pipeline: ${l.pipeline} | Valore: €${l.value || 0}${l.phone ? ` | Tel: ${l.phone}` : ''} (ID: ${l.id})`).join("\n");

    const taskList = tasks.slice(0, 15).map(t => `- [${t.status}] ${t.title}${t.priority ? ` (priorità: ${t.priority})` : ''}${t.due_date ? ` scadenza: ${t.due_date}` : ''} (ID: ${t.id})`).join("\n");

    const orderList = orders.slice(0, 15).map(o => `- ${o.number || 'N/D'} | ${o.customer_name || 'N/D'} | €${o.total_amount || 0} | Status: ${o.status} | Tipo: ${o.order_type} (ID: ${o.id})`).join("\n");

    const commessaList = commesse.slice(0, 15).map((c: any) => {
      const cliente = c.customers?.name || c.customers?.company_name || 'N/D';
      const loc = [c.shipping_city, c.shipping_province].filter(Boolean).join(', ');
      return `- ${c.number} | ${c.title} | Status: ${c.status} | Tipo: ${c.type}${c.deadline ? ` | Scadenza: ${c.deadline}` : ''} | Cliente: ${cliente}${loc ? ` | Località: ${loc}` : ''}${c.article ? ` | Articolo: ${c.article}` : ''} (ID: ${c.id})`;
    }).join("\n");

    const phaseList = commessaPhases.slice(0, 20).map((p: any) => `- Fase: ${p.phase_type} | Commessa: ${p.commesse?.number || 'N/D'} (${p.commesse?.title || ''}) | Stato: ${p.status}${p.scheduled_date ? ` | Calendarizzata: ${p.scheduled_date}` : ' | NON calendarizzata'} (Phase ID: ${p.id}, Commessa ID: ${p.commessa_id})`).join("\n");

    // Build conversation history for context
    const historyStr = history.map(m => {
      const role = m.direction === "inbound" ? "Utente" : "Becca";
      return `${role}: ${m.content || `[${m.message_type}]`}`;
    }).join("\n");

    // Lead stats
    const leadStats = {
      total: leads.length,
      new: leads.filter(l => l.status === 'new').length,
      contacted: leads.filter(l => l.status === 'contacted').length,
      qualified: leads.filter(l => l.status === 'qualified').length,
    };

    const taskStats = {
      total: tasks.length,
      todo: tasks.filter(t => t.status === 'todo').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      done: tasks.filter(t => t.status === 'done').length,
    };

    const orderStats = {
      total: orders.length,
      draft: orders.filter(o => o.status === 'draft').length,
      inProgress: orders.filter(o => o.status === 'in_progress').length,
      completed: orders.filter(o => o.status === 'completed').length,
    };

    const today = new Date().toISOString().split('T')[0];
    const allowedActionsStr = body.allowed_actions.join(", ");

    const systemPrompt = `${persona}

DATA DI OGGI: ${today}

Sei Becca, l'assistente AI aziendale di Zapper collegata all'ERP. Puoi:
1. CONSULTARE dati ERP e rispondere a domande (lead, ordini, task, commesse, clienti)
2. CREARE nuove entità (prima nota, task, ordini, lead)
3. AGGIORNARE entità esistenti (lead status, task status)
4. CONVERSARE in modo naturale e professionale

AZIONI DISPONIBILI PER QUESTO UTENTE: ${allowedActionsStr}

═══ DATI ERP IN TEMPO REALE ═══

📊 STATISTICHE:
- Lead: ${leadStats.total} totali (${leadStats.new} nuovi, ${leadStats.contacted} contattati, ${leadStats.qualified} qualificati)
- Task: ${taskStats.total} totali (${taskStats.todo} da fare, ${taskStats.inProgress} in corso, ${taskStats.done} completati)
- Ordini: ${orderStats.total} totali (${orderStats.draft} bozze, ${orderStats.inProgress} in corso, ${orderStats.completed} completati)
- Commesse: ${commesse.length} totali

👥 CLIENTI/FORNITORI:
${customerList || "Nessuno in database"}

🎯 LEAD RECENTI:
${leadList || "Nessun lead"}

📋 TASK RECENTI:
${taskList || "Nessun task"}

🛒 ORDINI RECENTI:
${orderList || "Nessun ordine"}

🏗️ COMMESSE RECENTI:
${commessaList || "Nessuna commessa"}

📅 FASI COMMESSE DA CALENDARIZZARE:
${phaseList || "Nessuna fase pendente"}

═══ STORICO CONVERSAZIONE ═══
${historyStr || "(Primo messaggio)"}

═══ ISTRUZIONI DI RISPOSTA ═══

Per ogni messaggio dell'utente devi classificare cosa vuole fare e rispondere in JSON.

TIPI DI AZIONE:
- "query": L'utente chiede informazioni sull'ERP (lead, ordini, task, statistiche). Rispondi direttamente con i dati. NON servono conferme.
- "prima_nota": Registrare un movimento contabile
- "task": Creare un task
- "sales_order": Creare un ordine di vendita
- "lead": Creare un nuovo lead CRM
- "update_lead": Aggiornare lo stato di un lead esistente
- "update_task": Aggiornare lo stato di un task esistente
- "schedule_commessa": Calendarizzare (impostare una data) per una fase di una commessa. L'utente potrebbe dire "calendarizza la commessa COM-2026-0010 per il 20 marzo" o "programma la produzione della commessa X per lunedì"
- "conversation": Messaggio conversazionale generico (saluti, ringraziamenti, domande generiche su Becca)
- "unknown": Non classificabile

METODI DI PAGAMENTO VALIDI: contanti, carta, bonifico, anticipo_personale, carta_aziendale, anticipo_dipendente, carta_q8, american_express, banca, banca_intesa, cassa

Rispondi ESCLUSIVAMENTE in formato JSON valido:
{
  "action": "query" | "prima_nota" | "task" | "sales_order" | "lead" | "update_lead" | "update_task" | "schedule_commessa" | "conversation" | "unknown",
  "confidence": numero da 0 a 100,
  "data": {
    // Compilare i campi rilevanti per l'azione (vedi sotto)
  },
  "reply_message": "Messaggio da inviare all'utente via WhatsApp con emoji e formattazione WhatsApp (*grassetto*, _corsivo_). Per 'query' includi i dati richiesti in modo leggibile. Per azioni di creazione, riepiloga e chiedi conferma.",
  "note_ai": "eventuali dubbi o note interne"
}

CAMPI DATA PER AZIONE:
- query: { "query_type": "leads|tasks|orders|commesse|stats|general", "response_data": "testo con i risultati" }
- prima_nota: { "tipo": "entrata|uscita", "importo_totale": N, "imponibile": N, "iva_aliquota": N, "iva_importo": N, "regime_iva": "...", "descrizione": "...", "fornitore_cliente_id": "UUID"|null, "fornitore_cliente_nome": "...", "data_documento": "YYYY-MM-DD", "metodo_pagamento": "..." }
- task: { "titolo": "...", "descrizione": "...", "scadenza": "YYYY-MM-DD"|null, "priorita": "low|medium|high|urgent" }
- sales_order: { "cliente_id": "UUID"|null, "cliente_nome": "...", "prodotti": "...", "importo": N, "note": "..." }
- lead: { "nome_contatto": "...", "azienda": "...", "telefono": "...", "email": "...", "interesse": "...", "paese": "..." }
- update_lead: { "lead_id": "UUID", "new_status": "new|contacted|qualified|proposal|negotiation|won|lost", "note": "..." }
- update_task: { "task_id": "UUID", "new_status": "todo|in_progress|done", "note": "..." }
- schedule_commessa: { "commessa_id": "UUID della commessa", "phase_id": "UUID della fase (se noto)", "phase_type": "produzione|installazione|manutenzione|spedizione", "scheduled_date": "YYYY-MM-DD", "note": "..." }. IMPORTANTE: l'utente potrebbe NON indicare il numero commessa ma riferirsi al cliente (es. "calendarizza quella di Rossi") o alla località (es. "programma la commessa di Milano"). Devi dedurre la commessa corretta incrociando i dati ERP: nome cliente, città, provincia, titolo, articolo. Se ci sono più match possibili, chiedi chiarimento. Se non specifica la fase, usa la prima fase pendente.
- conversation: {} (solo reply_message)

REGOLE IMPORTANTI:
1. Per "query", rispondi con confidence 100 e includi i dati in reply_message
2. Per "conversation", rispondi con confidence 100
3. Per azioni di creazione (prima_nota, task, sales_order, lead), usa confidence alta se i dati sono chiari
4. Quando l'utente dice "sì" o "confermo" a un messaggio precedente di conferma, usa confidence 100
5. Rispondi SEMPRE in italiano
6. Usa formattazione WhatsApp nel reply_message: *grassetto*, _corsivo_, ~barrato~`;

    // Build messages array with conversation context
    const aiMessages: any[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: textToAnalyze },
    ];

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        temperature: 0.3,
        max_tokens: 2000,
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
      if (jsonMatch) { parsed = JSON.parse(jsonMatch[0]); }
      else { throw new Error("No JSON found in AI response"); }
    } catch (e) {
      throw new Error(`Failed to parse AI response: ${e.message}`);
    }

    const action = parsed.action || "unknown";
    const confidence = parsed.confidence || 0;
    const data = parsed.data || {};
    const replyMessage = parsed.reply_message || parsed.confirmation_message || "";

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
      confirmation_question: replyMessage,
      status: (action === "query" || action === "conversation") ? "completed" :
              confidence >= autoThreshold ? "completed" : "awaiting_confirmation",
    }).select().single();

    let entityId: string | null = null;
    let entityType: string | null = null;
    let resultMessage = "";

    // Handle different action types
    if (action === "query" || action === "conversation") {
      // Direct reply - no action needed
      await sendWhatsAppReply(supabaseUrl, supabaseServiceKey, body.account_id, body.conversation_id, replyMessage);
    } else if (confidence >= autoThreshold && action !== "unknown") {
      // Auto-execute
      const result = await executeAction(supabase, action, data, settings);
      entityId = result.entityId;
      entityType = result.entityType;
      resultMessage = result.message;

      if (logEntry) {
        await supabase.from("becca_activity_log").update({
          entity_id: entityId, entity_type: entityType, status: "completed",
        }).eq("id", logEntry.id);
      }

      const finalMessage = `✅ *Becca - Azione completata*\n\n${resultMessage}\n\n_Vuoi modificare qualcosa? Rispondi con le correzioni._`;
      await sendWhatsAppReply(supabaseUrl, supabaseServiceKey, body.account_id, body.conversation_id, finalMessage);
    } else if (action !== "unknown") {
      await sendWhatsAppReply(supabaseUrl, supabaseServiceKey, body.account_id, body.conversation_id, replyMessage);
    } else {
      const unknownMsg = replyMessage || `🤔 *Becca*\n\nNon ho capito bene cosa vuoi fare. Puoi riformulare?\n\n💡 _Esempi:_\n• "Uscita 500€ fornitore Rossi, fattura"\n• "Ricordami di chiamare Bianchi domani"\n• "Quanti lead nuovi abbiamo?"\n• "Che ordini sono aperti?"\n• "Nuovo contatto: Giovanni Neri, tel 333..."`;
      await sendWhatsAppReply(supabaseUrl, supabaseServiceKey, body.account_id, body.conversation_id, unknownMsg);
    }

    return new Response(
      JSON.stringify({ success: true, action, confidence, entity_id: entityId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Becca AI error:", error);

    try {
      const body2: BeccaRequest = await req.clone().json().catch(() => ({} as any));
      await supabase.from("becca_activity_log").insert({
        account_id: body2.account_id || null,
        authorized_user_id: body2.authorized_user_id || null,
        conversation_id: body2.conversation_id || null,
        message_id: body2.message_id || null,
        action_type: "error",
        raw_message: body2.content || null,
        status: "failed",
        error_message: error.message,
      });
    } catch (e) { console.error("Failed to log error:", e); }

    try {
      const body2: BeccaRequest = await req.clone().json().catch(() => ({} as any));
      if (body2.conversation_id && body2.account_id) {
        await sendWhatsAppReply(supabaseUrl, supabaseServiceKey, body2.account_id, body2.conversation_id,
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
  supabase: any, action: string, data: any, settings: any
): Promise<{ entityId: string | null; entityType: string | null; message: string }> {

  switch (action) {
    case "prima_nota": {
      const dateFormatted = (data.data_documento || new Date().toISOString().split('T')[0]).replace(/-/g, '');
      const prefix = `SGN-${dateFormatted}`;
      const { count } = await supabase.from('accounting_entries')
        .select('*', { count: 'exact', head: true }).like('account_code', `${prefix}-%`);
      const code = `${prefix}-${String((count || 0) + 1).padStart(2, '0')}`;

      const { data: entry, error } = await supabase.from('accounting_entries').insert({
        amount: data.importo_totale || 0,
        direction: data.tipo === 'entrata' ? 'entrata' : 'uscita',
        document_type: 'movimento',
        document_date: data.data_documento || new Date().toISOString().split('T')[0],
        status: 'segnalazione',
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
        entityId: entry.id, entityType: "accounting_entries",
        message: `📋 Codice: *${code}*\n${data.tipo === 'entrata' ? '📥' : '📤'} Tipo: ${data.tipo === 'entrata' ? 'Entrata' : 'Uscita'}\n💰 Importo: €${(data.importo_totale || 0).toFixed(2)}\n${data.imponibile ? `📊 Imponibile: €${data.imponibile.toFixed(2)}\n` : ''}${data.iva_importo ? `🏷️ IVA: €${data.iva_importo.toFixed(2)} (${data.iva_aliquota}%)\n` : ''}📝 ${data.descrizione || 'N/D'}\n${data.fornitore_cliente_nome ? `👤 ${data.fornitore_cliente_nome}\n` : ''}\n⚠️ _Segnalazione da validare in Prima Nota_`
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
        entityId: task.id, entityType: "tasks",
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
        entityId: order.id, entityType: "sales_orders",
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
        entityId: lead.id, entityType: "leads",
        message: `👤 Lead creato: *${data.nome_contatto}*\n${data.azienda ? `🏢 ${data.azienda}\n` : ''}${data.telefono ? `📱 ${data.telefono}\n` : ''}${data.email ? `✉️ ${data.email}\n` : ''}${data.interesse ? `💡 Interesse: ${data.interesse}\n` : ''}${data.paese ? `🌍 ${data.paese}\n` : ''}📌 Pipeline: ZAPPER`
      };
    }

    case "update_lead": {
      if (!data.lead_id) throw new Error("lead_id mancante per update");
      const updatePayload: any = {};
      if (data.new_status) updatePayload.status = data.new_status;
      if (data.note) {
        const { data: existing } = await supabase.from('leads').select('notes').eq('id', data.lead_id).single();
        updatePayload.notes = `${existing?.notes || ''}\n[Becca] ${data.note}`;
      }
      const { error } = await supabase.from('leads').update(updatePayload).eq('id', data.lead_id);
      if (error) throw new Error(`Failed to update lead: ${error.message}`);

      return {
        entityId: data.lead_id, entityType: "leads",
        message: `✏️ Lead aggiornato\n${data.new_status ? `📌 Nuovo stato: *${data.new_status}*\n` : ''}${data.note ? `📝 Nota: ${data.note}` : ''}`
      };
    }

    case "update_task": {
      if (!data.task_id) throw new Error("task_id mancante per update");
      const updatePayload: any = {};
      if (data.new_status) updatePayload.status = data.new_status;
      const { error } = await supabase.from('tasks').update(updatePayload).eq('id', data.task_id);
      if (error) throw new Error(`Failed to update task: ${error.message}`);

      return {
        entityId: data.task_id, entityType: "tasks",
        message: `✏️ Task aggiornato\n📌 Nuovo stato: *${data.new_status || 'aggiornato'}*`
      };
    }

    case "schedule_commessa": {
      let phaseId = data.phase_id;
      const scheduledDate = data.scheduled_date;
      if (!scheduledDate) throw new Error("Data di calendarizzazione mancante");

      // If no phase_id, find the first pending phase for the commessa
      if (!phaseId && data.commessa_id) {
        const { data: phases } = await supabase.from("commessa_phases")
          .select("id, phase_type, phase_order")
          .eq("commessa_id", data.commessa_id)
          .eq("status", "pending")
          .order("phase_order", { ascending: true })
          .limit(1);
        if (phases && phases.length > 0) {
          phaseId = phases[0].id;
        }
      }

      if (!phaseId) throw new Error("Nessuna fase pendente trovata per questa commessa");

      const { error } = await supabase.from("commessa_phases").update({
        scheduled_date: new Date(scheduledDate).toISOString(),
      }).eq("id", phaseId);
      if (error) throw new Error(`Failed to schedule commessa phase: ${error.message}`);

      // Get commessa info for reply
      const { data: commessa } = await supabase.from("commesse")
        .select("number, title").eq("id", data.commessa_id).single();

      return {
        entityId: phaseId, entityType: "commessa_phases",
        message: `📅 Commessa calendarizzata!\n\n🏗️ Commessa: *${commessa?.number || 'N/D'}* - ${commessa?.title || ''}\n📌 Fase: ${data.phase_type || 'N/D'}\n📆 Data: *${scheduledDate}*${data.note ? `\n📝 ${data.note}` : ''}`
      };
    }

    default:
      return { entityId: null, entityType: null, message: "Azione non riconosciuta" };
  }
}

async function sendWhatsAppReply(
  supabaseUrl: string, supabaseServiceKey: string,
  accountId: string, conversationId: string, message: string
) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        account_id: accountId, to: null,
        conversation_id: conversationId,
        message: message, type: "text",
      }),
    });
  } catch (e) { console.error("Failed to send Becca reply:", e); }
}
