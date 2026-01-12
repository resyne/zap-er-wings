import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-api-key",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log("WaSender webhook received:", JSON.stringify(payload, null, 2));

    const event = payload.event;

    // Handle different event types based on WaSender API documentation
    switch (event) {
      case "messages.received": {
        // New incoming message - WaSender format
        await handleIncomingMessage(supabase, payload.data);
        break;
      }
      case "messages.upsert": {
        // Alternative event name (legacy)
        await handleIncomingMessage(supabase, payload.data);
        break;
      }
      case "message.status": {
        // Message status update (sent, delivered, read)
        await handleMessageStatus(supabase, payload.data);
        break;
      }
      case "session.status": {
        // Session status change (connected, disconnected)
        await handleSessionStatus(supabase, payload.data);
        break;
      }
      default:
        console.log(`Unhandled event type: ${event}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in wasender-webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleIncomingMessage(supabase: any, data: any) {
  try {
    // WaSender format: data.messages is a single object (not array)
    const messageData = data.messages || data.message || data;
    const key = messageData.key || {};
    
    // Extract sender phone - use cleanedSenderPn for private chats, cleanedParticipantPn for groups
    const senderPhone = key.cleanedParticipantPn || key.cleanedSenderPn || 
                        key.remoteJid?.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, "") || "";
    
    if (!senderPhone) {
      console.error("No sender phone found in message:", JSON.stringify(key));
      return;
    }

    // Get unified message content - WaSender provides messageBody field
    const messageContent = messageData.messageBody || 
                          messageData.message?.conversation ||
                          messageData.message?.extendedTextMessage?.text ||
                          messageData.body ||
                          messageData.text ||
                          "";
    
    // Determine message type
    const rawMessage = messageData.message || {};
    const messageType = rawMessage.imageMessage ? "image" :
                       rawMessage.videoMessage ? "video" :
                       rawMessage.audioMessage ? "audio" :
                       rawMessage.documentMessage ? "document" :
                       rawMessage.stickerMessage ? "sticker" :
                       "text";

    // Get push name (sender's WhatsApp name)
    const pushName = messageData.pushName || key.pushName || null;

    console.log(`Processing incoming message from ${senderPhone}: ${messageContent.substring(0, 50)}...`);

    // Find matching account - we need to identify which session received this
    // For now, find the first active account that could match
    const { data: accounts, error: accountError } = await supabase
      .from("wasender_accounts")
      .select("id, phone_number, session_id")
      .eq("is_active", true);

    if (accountError) {
      console.error("Error fetching accounts:", accountError);
      return;
    }

    if (!accounts || accounts.length === 0) {
      console.error("No active WaSender accounts found");
      return;
    }

    // Use the first active account (in production, match by session_id if available)
    const account = accounts[0];

    // Find or create conversation
    let { data: conversation, error: convError } = await supabase
      .from("wasender_conversations")
      .select("id, unread_count")
      .eq("account_id", account.id)
      .eq("customer_phone", senderPhone)
      .maybeSingle();

    if (convError && convError.code !== "PGRST116") {
      console.error("Error finding conversation:", convError);
      return;
    }

    if (!conversation) {
      // Create new conversation
      const { data: newConv, error: createError } = await supabase
        .from("wasender_conversations")
        .insert({
          account_id: account.id,
          customer_phone: senderPhone,
          customer_name: pushName,
          status: "active",
          unread_count: 1,
          last_message_at: new Date().toISOString(),
          last_message_preview: messageContent.substring(0, 100)
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating conversation:", createError);
        return;
      }
      conversation = newConv;
      console.log(`Created new conversation for ${senderPhone}`);
    } else {
      // Update existing conversation
      const { error: updateError } = await supabase
        .from("wasender_conversations")
        .update({ 
          unread_count: (conversation.unread_count || 0) + 1,
          last_message_at: new Date().toISOString(),
          last_message_preview: messageContent.substring(0, 100),
          customer_name: pushName || undefined // Update name if we have it
        })
        .eq("id", conversation.id);

      if (updateError) {
        console.error("Error updating conversation:", updateError);
      }
    }

    // Save the message
    const { error: msgError } = await supabase
      .from("wasender_messages")
      .insert({
        conversation_id: conversation.id,
        direction: "inbound",
        message_type: messageType,
        content: messageContent,
        status: "received",
        wasender_id: key.id || null
      });

    if (msgError) {
      console.error("Error saving message:", msgError);
      return;
    }

    console.log(`Message saved successfully from ${senderPhone}`);

  } catch (error) {
    console.error("Error handling incoming message:", error);
  }
}

async function handleMessageStatus(supabase: any, data: any) {
  try {
    const messageId = data.id || data.key?.id;
    const status = data.status || data.update?.status;

    if (!messageId || !status) {
      console.log("Missing messageId or status in status update");
      return;
    }

    // Map WaSender status to our status
    const statusMap: Record<string, string> = {
      "sent": "sent",
      "delivered": "delivered",
      "read": "read",
      "failed": "failed",
      "pending": "pending",
      "server": "sent",
      "delivery": "delivered"
    };

    const mappedStatus = statusMap[status.toLowerCase()] || status;

    // Update message status if we have the wasender_id
    const { error } = await supabase
      .from("wasender_messages")
      .update({ status: mappedStatus })
      .eq("wasender_id", messageId);

    if (error) {
      console.error("Error updating message status:", error);
    } else {
      console.log(`Message ${messageId} status updated to: ${mappedStatus}`);
    }

  } catch (error) {
    console.error("Error handling message status:", error);
  }
}

async function handleSessionStatus(supabase: any, data: any) {
  try {
    const sessionStatus = data.status;
    const sessionId = data.sessionId || data.session_id;
    
    console.log(`Session ${sessionId} status changed to: ${sessionStatus}`);

    if (sessionId) {
      // Update account status based on session status
      const isActive = sessionStatus === "connected" || sessionStatus === "active";
      
      const { error } = await supabase
        .from("wasender_accounts")
        .update({ 
          status: sessionStatus,
          is_active: isActive
        })
        .eq("session_id", sessionId);

      if (error) {
        console.error("Error updating account status:", error);
      }
    }

  } catch (error) {
    console.error("Error handling session status:", error);
  }
}
