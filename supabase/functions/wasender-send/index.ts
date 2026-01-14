import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendMessageRequest {
  to: string;
  text?: string;
  accountId: string;
  conversationId: string;
  messageId?: string; // If provided, update existing message instead of creating new
  sentBy?: string; // User ID of the sender
  // Media options
  imageUrl?: string;
  videoUrl?: string;
  documentUrl?: string;
  audioUrl?: string;
  fileName?: string;
  messageType?: "text" | "image" | "video" | "document" | "audio";
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
    const body = await req.json() as SendMessageRequest;
    const { to, text, accountId, conversationId, messageId, sentBy, imageUrl, videoUrl, documentUrl, audioUrl, fileName, messageType = "text" } = body;

    if (!to) {
      return new Response(
        JSON.stringify({ error: "Parametro 'to' mancante" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate that we have content to send
    const hasMedia = imageUrl || videoUrl || documentUrl || audioUrl;
    if (!text && !hasMedia) {
      return new Response(
        JSON.stringify({ error: "Devi fornire un testo o un file da inviare" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone number (remove spaces, ensure format)
    const normalizedPhone = to.replace(/\s+/g, "").replace(/^00/, "+");

    console.log(`Sending WaSender message to ${normalizedPhone}, type: ${messageType}`);

    // Build the request body for WaSender API
    const wasenderBody: Record<string, string> = {
      to: normalizedPhone,
    };

    // Add text/caption if provided
    if (text) {
      wasenderBody.text = text;
    }

    // Add media URL based on type
    if (imageUrl) {
      wasenderBody.imageUrl = imageUrl;
    } else if (videoUrl) {
      wasenderBody.videoUrl = videoUrl;
    } else if (documentUrl) {
      wasenderBody.documentUrl = documentUrl;
      if (fileName) {
        wasenderBody.fileName = fileName;
      }
    } else if (audioUrl) {
      wasenderBody.audioUrl = audioUrl;
    }

    console.log("WaSender request body:", JSON.stringify(wasenderBody));

    // Call WaSenderAPI
    const wasenderResponse = await fetch("https://www.wasenderapi.com/api/send-message", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${wasenderApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(wasenderBody),
    });

    const wasenderData = await wasenderResponse.json();
    console.log("WaSender response:", wasenderData);

    // Determine the actual message type
    const actualMessageType = imageUrl ? "image" : 
                              videoUrl ? "video" : 
                              documentUrl ? "document" : 
                              audioUrl ? "audio" : "text";

    // Get media URL for storage
    const mediaUrl = imageUrl || videoUrl || documentUrl || audioUrl || null;

    if (!wasenderResponse.ok) {
      // Update or insert failed message
      if (messageId) {
        await supabase.from("wasender_messages")
          .update({
            status: "failed",
            error_message: wasenderData.message || wasenderData.error || "Errore sconosciuto",
          })
          .eq("id", messageId);
      } else {
        await supabase.from("wasender_messages").insert({
          conversation_id: conversationId,
          direction: "outbound",
          message_type: actualMessageType,
          content: text || null,
          media_url: mediaUrl,
          status: "failed",
          error_message: wasenderData.message || wasenderData.error || "Errore sconosciuto",
          sent_by: sentBy || null,
        });
      }

      return new Response(
        JSON.stringify({ 
          error: wasenderData.message || wasenderData.error || "Errore invio messaggio",
          details: wasenderData 
        }),
        { status: wasenderResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update or insert successful message
    let messageData;
    if (messageId) {
      // Update existing message
      const { data, error: updateError } = await supabase
        .from("wasender_messages")
        .update({
          status: "sent",
          wasender_id: wasenderData.data?.msgId?.toString() || null,
        })
        .eq("id", messageId)
        .select()
        .single();
      
      if (updateError) {
        console.error("Error updating message:", updateError);
      }
      messageData = data;
    } else {
      // Insert new message (for calls without pre-created message)
      const { data, error: insertError } = await supabase
        .from("wasender_messages")
        .insert({
          conversation_id: conversationId,
          direction: "outbound",
          message_type: actualMessageType,
          content: text || null,
          media_url: mediaUrl,
          status: "sent",
          wasender_id: wasenderData.data?.msgId?.toString() || null,
          sent_by: sentBy || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error saving message:", insertError);
      }
      messageData = data;
    }

    // Update conversation with last message
    const preview = text || (actualMessageType === "image" ? "📷 Immagine" : 
                            actualMessageType === "video" ? "🎬 Video" : 
                            actualMessageType === "document" ? "📄 Documento" : 
                            actualMessageType === "audio" ? "🎵 Audio" : "Messaggio");
    
    await supabase
      .from("wasender_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: preview.substring(0, 100),
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
