import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const webhookSecret = Deno.env.get("WASENDER_WEBHOOK_SECRET");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify webhook signature if secret is configured
    const signature = req.headers.get("x-webhook-signature");
    if (webhookSecret && signature !== webhookSecret) {
      console.error("Invalid webhook signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = await req.json();
    console.log("WaSender webhook received:", JSON.stringify(payload, null, 2));

    const event = payload.event;
    const data = payload.data;

    // Handle different event types
    switch (event) {
      case "messages.upsert": {
        // New incoming message
        await handleIncomingMessage(supabase, data);
        break;
      }
      case "message.status": {
        // Message status update (sent, delivered, read)
        await handleMessageStatus(supabase, data);
        break;
      }
      case "session.status": {
        // Session status change (connected, disconnected)
        await handleSessionStatus(supabase, data);
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
    const message = data.message || data;
    const key = data.key || message.key;
    
    // Extract sender info
    const remoteJid = key?.remoteJid || message.from;
    if (!remoteJid) {
      console.error("No remoteJid found in message");
      return;
    }

    // Clean phone number (remove @s.whatsapp.net suffix)
    const senderPhone = remoteJid.replace(/@s\.whatsapp\.net|@g\.us/g, "");
    
    // Get message content
    const messageContent = message.message?.conversation || 
                          message.message?.extendedTextMessage?.text ||
                          message.body ||
                          message.text ||
                          "";
    
    const messageType = message.message?.imageMessage ? "image" :
                       message.message?.videoMessage ? "video" :
                       message.message?.audioMessage ? "audio" :
                       message.message?.documentMessage ? "document" :
                       "text";

    // Find the account by looking at all accounts
    // In production, you might want to pass the session ID in the webhook
    const { data: accounts } = await supabase
      .from("wasender_accounts")
      .select("id, phone_number")
      .eq("is_active", true);

    if (!accounts || accounts.length === 0) {
      console.error("No active WaSender accounts found");
      return;
    }

    // For now, use the first active account (could be improved with session matching)
    const account = accounts[0];

    // Find or create conversation
    let { data: conversation } = await supabase
      .from("wasender_conversations")
      .select("id")
      .eq("account_id", account.id)
      .eq("customer_phone", senderPhone)
      .maybeSingle();

    if (!conversation) {
      // Create new conversation
      const { data: newConv, error: convError } = await supabase
        .from("wasender_conversations")
        .insert({
          account_id: account.id,
          customer_phone: senderPhone,
          customer_name: message.pushName || null,
          status: "active",
          unread_count: 1
        })
        .select()
        .single();

      if (convError) {
        console.error("Error creating conversation:", convError);
        return;
      }
      conversation = newConv;
    } else {
      // Increment unread count
      await supabase
        .from("wasender_conversations")
        .update({ 
          unread_count: supabase.rpc("increment", { x: 1 }),
          last_message_at: new Date().toISOString(),
          last_message_preview: messageContent.substring(0, 100)
        })
        .eq("id", conversation.id);
    }

    // Save the message
    const { error: msgError } = await supabase
      .from("wasender_messages")
      .insert({
        conversation_id: conversation.id,
        direction: "inbound",
        message_type: messageType,
        content: messageContent,
        status: "received"
      });

    if (msgError) {
      console.error("Error saving message:", msgError);
      return;
    }

    // Update conversation last message
    await supabase
      .from("wasender_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: messageContent.substring(0, 100)
      })
      .eq("id", conversation.id);

    console.log(`Message saved from ${senderPhone}: ${messageContent.substring(0, 50)}...`);

  } catch (error) {
    console.error("Error handling incoming message:", error);
  }
}

async function handleMessageStatus(supabase: any, data: any) {
  try {
    const messageId = data.id || data.key?.id;
    const status = data.status || data.update?.status;

    if (!messageId || !status) return;

    // Map WaSender status to our status
    const statusMap: Record<string, string> = {
      "sent": "sent",
      "delivered": "delivered",
      "read": "read",
      "failed": "failed",
      "pending": "pending"
    };

    const mappedStatus = statusMap[status.toLowerCase()] || status;

    // Note: We'd need to store WaSender message IDs to properly update status
    // For now, this is a placeholder for the status update logic
    console.log(`Message ${messageId} status updated to: ${mappedStatus}`);

  } catch (error) {
    console.error("Error handling message status:", error);
  }
}

async function handleSessionStatus(supabase: any, data: any) {
  try {
    const sessionStatus = data.status;
    console.log(`Session status changed to: ${sessionStatus}`);

    // Could update account status based on session status
    // This would require storing session ID in the account

  } catch (error) {
    console.error("Error handling session status:", error);
  }
}
