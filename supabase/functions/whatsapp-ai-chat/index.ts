import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

interface AIRequest {
  conversation_id: string;
  account_id: string;
  action: "suggest" | "send_auto"; // suggest = preview, send_auto = send directly
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: AIRequest = await req.json();
    const { conversation_id, account_id, action } = body;

    console.log(`AI Chat request: action=${action}, conversation=${conversation_id}`);

    // Get account with AI settings
    const { data: account, error: accountError } = await supabase
      .from("whatsapp_accounts")
      .select("*")
      .eq("id", account_id)
      .single();

    if (accountError || !account) {
      throw new Error("Account not found");
    }

    if (!account.ai_chat_enabled) {
      throw new Error("AI Chat is not enabled for this account");
    }

    // Get conversation
    const { data: conversation, error: convError } = await supabase
      .from("whatsapp_conversations")
      .select("*, lead:leads(*)")
      .eq("id", conversation_id)
      .single();

    if (convError || !conversation) {
      throw new Error("Conversation not found");
    }

    // Get last 20 messages for context
    const { data: messages, error: messagesError } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (messagesError) {
      throw new Error("Failed to fetch messages");
    }

    // Reverse to get chronological order
    const chronologicalMessages = (messages || []).reverse();

    // Build conversation context for AI
    const conversationContext = chronologicalMessages.map(m => {
      const role = m.direction === "inbound" ? "Cliente" : "Operatore";
      let content = m.content || "";
      if (m.template_name) {
        content = `[Template: ${m.template_name}]`;
      }
      return `${role}: ${content}`;
    }).join("\n");

    // Get lead info if available
    const leadInfo = conversation.lead ? {
      name: conversation.lead.contact_name || conversation.lead.company_name,
      country: conversation.lead.country,
      interest: conversation.lead.notes,
      status: conversation.lead.status,
      pipeline: conversation.lead.pipeline,
    } : null;

    // Build system prompt
    const defaultSystemPrompt = `Sei un assistente di vendita per forni professionali. 
Il tuo obiettivo è:
1. Rispondere in modo cordiale e professionale
2. Capire le esigenze del cliente
3. Proporre i prodotti adatti
4. Portare il cliente verso una decisione d'acquisto
5. Rispondere nella stessa lingua del cliente

Mantieni le risposte brevi e conversazionali, come in una chat WhatsApp.`;

    const systemPrompt = account.ai_system_prompt || defaultSystemPrompt;

    // Build the AI prompt
    const aiPrompt = `${systemPrompt}

${leadInfo ? `INFORMAZIONI CLIENTE:
- Nome: ${leadInfo.name || 'Non disponibile'}
- Paese: ${leadInfo.country || 'Non specificato'}
- Interesse: ${leadInfo.interest || 'Da scoprire'}
- Stato: ${leadInfo.status || 'Nuovo'}
- Pipeline: ${leadInfo.pipeline || 'Non specificata'}
` : ''}

CRONOLOGIA CONVERSAZIONE:
${conversationContext || "[Nessun messaggio precedente]"}

ISTRUZIONI:
Genera una risposta appropriata per continuare la conversazione.
Rispondi come farebbe un venditore esperto in una chat WhatsApp.

Inoltre, suggerisci un delay intelligente (in minuti, da 1 a 15) prima di inviare il messaggio, 
basandoti sull'urgenza percepita e sulla natura della conversazione:
- Se il cliente sembra impaziente o ha domande urgenti: delay breve (1-3 min)
- Se è una conversazione normale: delay medio (3-8 min)
- Se stai facendo follow-up o il cliente è poco reattivo: delay più lungo (8-15 min)

Rispondi SEMPRE in questo formato JSON:
{
  "message": "Il tuo messaggio di risposta qui",
  "delay_minutes": 5,
  "reasoning": "Breve spiegazione del perché hai scelto questo messaggio e questo delay"
}`;

    console.log("Calling Lovable AI Gateway...");

    // Call Lovable AI Gateway
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          { role: "user", content: aiPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error("Rate limit exceeded, please try again later");
      }
      if (aiResponse.status === 402) {
        throw new Error("AI credits exhausted, please add funds");
      }
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";
    
    console.log("AI Raw Response:", rawContent);

    // Parse AI response
    let parsedResponse;
    try {
      // Try to extract JSON from the response
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback: use the raw content as message
        parsedResponse = {
          message: rawContent.trim(),
          delay_minutes: 5,
          reasoning: "Risposta generata automaticamente"
        };
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      parsedResponse = {
        message: rawContent.trim(),
        delay_minutes: 5,
        reasoning: "Risposta generata automaticamente (parsing fallback)"
      };
    }

    const suggestedMessage = parsedResponse.message || "Ciao! Come posso aiutarti?";
    const delayMinutes = Math.min(15, Math.max(1, parsedResponse.delay_minutes || 5));
    const reasoning = parsedResponse.reasoning || "";

    if (action === "suggest") {
      // Just return the suggestion
      return new Response(
        JSON.stringify({
          success: true,
          suggested_message: suggestedMessage,
          delay_minutes: delayMinutes,
          reasoning: reasoning,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (action === "send_auto" && account.ai_auto_mode) {
      // Queue the message for sending with delay
      const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);

      // Delete any existing pending messages for this conversation
      await supabase
        .from("whatsapp_ai_queue")
        .delete()
        .eq("conversation_id", conversation_id)
        .eq("status", "pending");

      // Insert new scheduled message
      const { error: queueError } = await supabase
        .from("whatsapp_ai_queue")
        .insert({
          conversation_id,
          account_id,
          scheduled_at: scheduledAt.toISOString(),
          status: "pending",
          suggested_message: suggestedMessage,
          ai_reasoning: reasoning,
          delay_minutes: delayMinutes,
        });

      if (queueError) {
        console.error("Queue error:", queueError);
        throw new Error("Failed to queue AI message");
      }

      return new Response(
        JSON.stringify({
          success: true,
          queued: true,
          scheduled_at: scheduledAt.toISOString(),
          suggested_message: suggestedMessage,
          delay_minutes: delayMinutes,
          reasoning: reasoning,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        suggested_message: suggestedMessage,
        delay_minutes: delayMinutes,
        reasoning: reasoning,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("AI Chat error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
