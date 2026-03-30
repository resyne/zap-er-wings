import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Vesuviano WhatsApp account ID
const VESUVIANO_ACCOUNT_ID = "9d24956a-d020-485e-9c5b-8cce3e224508";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const minInactiveDays = body.min_inactive_days || 3;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - minInactiveDays);

    // Get Vesuviano conversations from whatsapp_conversations that are inactive
    const { data: conversations, error: convError } = await supabase
      .from("whatsapp_conversations")
      .select("id, account_id, customer_phone, customer_name, lead_id, last_message_at, unread_count")
      .eq("account_id", VESUVIANO_ACCOUNT_ID)
      .lt("last_message_at", cutoffDate.toISOString())
      .order("last_message_at", { ascending: true })
      .limit(200);

    if (convError) {
      console.error("Error fetching conversations:", convError);
      throw new Error("Failed to fetch conversations");
    }

    if (!conversations || conversations.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No inactive conversations found", generated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${conversations.length} inactive Vesuviano conversations`);

    // Filter out Becca authorized users (internal conversations)
    const { data: beccaUsers } = await supabase
      .from("becca_authorized_users")
      .select("phone_number")
      .eq("is_active", true);

    const beccaPhones = (beccaUsers || []).map(u => u.phone_number.replace(/\D/g, "").slice(-9));

    const externalConversations = conversations.filter(c => {
      const normalized = c.customer_phone.replace(/\D/g, "").slice(-9);
      return !beccaPhones.some(bp => bp === normalized);
    });

    console.log(`After filtering internal users: ${externalConversations.length} conversations`);

    // Filter out conversations that already have a pending/approved followup
    const conversationIds = externalConversations.map(c => c.id);
    const { data: existingFollowups } = await supabase
      .from("becca_followup_queue")
      .select("conversation_id, followup_number")
      .in("conversation_id", conversationIds)
      .in("status", ["pending", "approved", "edited"]);

    const existingSet = new Set((existingFollowups || []).map(f => f.conversation_id));
    const existingMaxFollowup = new Map<string, number>();
    (existingFollowups || []).forEach(f => {
      const current = existingMaxFollowup.get(f.conversation_id) || 0;
      existingMaxFollowup.set(f.conversation_id, Math.max(current, f.followup_number));
    });

    let generated = 0;

    for (const conv of externalConversations) {
      // Skip if already has a pending followup
      if (existingSet.has(conv.id)) continue;

      // Get last 15 messages from whatsapp_messages
      const { data: messages } = await supabase
        .from("whatsapp_messages")
        .select("direction, content, message_type, created_at, template_name")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(15);

      if (!messages || messages.length === 0) continue;

      const lastMsg = messages[0];
      const lastMsgDate = new Date(lastMsg.created_at);
      const daysInactive = Math.floor((Date.now() - lastMsgDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysInactive < minInactiveDays) continue;

      // Get previous followup count
      const { data: prevFollowups } = await supabase
        .from("becca_followup_queue")
        .select("followup_number")
        .eq("conversation_id", conv.id)
        .order("followup_number", { ascending: false })
        .limit(1);

      const nextFollowupNumber = (prevFollowups?.[0]?.followup_number || 0) + 1;

      // Get lead info
      let leadInfo = "";
      if (conv.lead_id) {
        const { data: lead } = await supabase
          .from("leads")
          .select("company_name, contact_name, email, phone, status, pipeline, notes, value")
          .eq("id", conv.lead_id)
          .single();

        if (lead) {
          leadInfo = `\nInformazioni lead:
- Azienda: ${lead.company_name || "N/D"}
- Contatto: ${lead.contact_name || "N/D"}
- Pipeline: ${lead.pipeline || "N/D"}
- Stato: ${lead.status || "N/D"}
- Valore: ${lead.value ? `€${lead.value}` : "N/D"}
- Note: ${lead.notes || "Nessuna"}`;
        }
      }

      // Build conversation history
      const historyText = (messages || []).reverse().map(m => {
        const dir = m.direction === "inbound" ? "CLIENTE" : "NOI";
        const content = m.template_name ? `[Template: ${m.template_name}]` : (m.content || `[${m.message_type}]`);
        return `[${dir}] ${content}`;
      }).join("\n");

      const prompt = `Sei un venditore esperto di forni professionali per Vesuviano Forni.
Analizza questa conversazione WhatsApp con un potenziale cliente e genera un messaggio di follow-up naturale e coinvolgente per capire se è ancora interessato.
${leadInfo}

Cronologia conversazione (dal più vecchio al più recente):
${historyText}

L'ultimo messaggio risale a ${daysInactive} giorni fa.
Questo è il follow-up numero ${nextFollowupNumber}.

Regole:
- Il messaggio deve sembrare naturale, come scritto da un venditore reale
- NON usare formalismi eccessivi
- NON iniziare con "Gentile" o simili
- Usa un tono amichevole ma professionale
- Se il cliente aveva espresso interesse per un prodotto specifico, menzionalo
- Se è il primo follow-up, sii delicato. Se sono successivi, sii più diretto
- Massimo 3-4 frasi
- Scrivi SOLO il messaggio, nient'altro
- Se il cliente ha scritto in un'altra lingua, rispondi in quella lingua
- NON includere saluti iniziali come "Ciao nome" perché quello verrà inviato separatamente tramite template

Rispondi con un JSON:
{"message": "il messaggio proposto", "reasoning": "breve spiegazione del perché questo messaggio", "language": "codice lingua del cliente: it, es, en, fr"}`;

      let aiResponse: any = null;

      // Try Lovable AI first
      if (lovableApiKey) {
        try {
          const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: "Sei un assistente di vendita per Vesuviano Forni. Rispondi SOLO in JSON valido." },
                { role: "user", content: prompt },
              ],
              tools: [{
                type: "function",
                function: {
                  name: "propose_followup",
                  description: "Propose a follow-up message for the customer",
                  parameters: {
                    type: "object",
                    properties: {
                      message: { type: "string", description: "The proposed follow-up message" },
                      reasoning: { type: "string", description: "Why this message was chosen" },
                    },
                    required: ["message", "reasoning"],
                    additionalProperties: false,
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "propose_followup" } },
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall) {
              aiResponse = JSON.parse(toolCall.function.arguments);
            }
          } else {
            console.error("Lovable AI error:", response.status, await response.text());
          }
        } catch (e) {
          console.error("Lovable AI error:", e);
        }
      }

      // Fallback to Gemini
      if (!aiResponse && geminiApiKey) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
              }),
            }
          );

          if (response.ok) {
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              const jsonMatch = text.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                aiResponse = JSON.parse(jsonMatch[0]);
              }
            }
          }
        } catch (e) {
          console.error("Gemini error:", e);
        }
      }

      if (!aiResponse) {
        console.log(`Skipping conversation ${conv.id}: no AI response`);
        continue;
      }

      // Insert into followup queue
      const { error: insertError } = await supabase
        .from("becca_followup_queue")
        .insert({
          account_id: VESUVIANO_ACCOUNT_ID,
          conversation_id: conv.id,
          customer_phone: conv.customer_phone,
          customer_name: conv.customer_name,
          lead_id: conv.lead_id,
          proposed_message: aiResponse.message,
          ai_reasoning: aiResponse.reasoning,
          followup_number: nextFollowupNumber,
          days_inactive: daysInactive,
          delay_days: minInactiveDays,
        });

      if (insertError) {
        console.error(`Error inserting followup for conv ${conv.id}:`, insertError);
      } else {
        generated++;
      }
    }

    console.log(`Generated ${generated} follow-up proposals for Vesuviano`);

    return new Response(
      JSON.stringify({ success: true, generated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error generating followups:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
