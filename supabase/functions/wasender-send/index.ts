import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendMessageRequest {
  to: string;
  text: string;
  accountId: string;
  conversationId: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const wasenderApiKey = Deno.env.get("WASENDER_API_KEY");

    if (!wasenderApiKey) {
      return new Response(
        JSON.stringify({ error: "WASENDER_API_KEY non configurata" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { to, text, accountId, conversationId } = await req.json() as SendMessageRequest;

    if (!to || !text) {
      return new Response(
        JSON.stringify({ error: "Parametri mancanti: to, text richiesti" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone number (remove spaces, ensure format)
    const normalizedPhone = to.replace(/\s+/g, "").replace(/^00/, "+");

    console.log(`Sending WaSender message to ${normalizedPhone}`);

    // Call WaSenderAPI
    const wasenderResponse = await fetch("https://www.wasenderapi.com/api/send-message", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${wasenderApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: normalizedPhone,
        text: text,
      }),
    });

    const wasenderData = await wasenderResponse.json();
    console.log("WaSender response:", wasenderData);

    if (!wasenderResponse.ok) {
      // Save failed message to database
      await supabase.from("wasender_messages").insert({
        conversation_id: conversationId,
        direction: "outbound",
        message_type: "text",
        content: text,
        status: "failed",
        error_message: wasenderData.message || wasenderData.error || "Errore sconosciuto",
      });

      return new Response(
        JSON.stringify({ 
          error: wasenderData.message || wasenderData.error || "Errore invio messaggio",
          details: wasenderData 
        }),
        { status: wasenderResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save successful message to database
    const { data: messageData, error: messageError } = await supabase
      .from("wasender_messages")
      .insert({
        conversation_id: conversationId,
        direction: "outbound",
        message_type: "text",
        content: text,
        status: "sent",
      })
      .select()
      .single();

    if (messageError) {
      console.error("Error saving message:", messageError);
    }

    // Update conversation with last message
    await supabase
      .from("wasender_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: text.substring(0, 100),
      })
      .eq("id", conversationId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: messageData,
        wasenderResponse: wasenderData 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in wasender-send:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
