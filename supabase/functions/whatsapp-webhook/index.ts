import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Handle webhook verification (GET request from Meta)
    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      // Verify token should match what you set in Meta dashboard
      const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "lovable_whatsapp_verify";

      if (mode === "subscribe" && token === verifyToken) {
        console.log("Webhook verified successfully");
        return new Response(challenge, { status: 200 });
      } else {
        console.log("Webhook verification failed");
        return new Response("Forbidden", { status: 403 });
      }
    }

    // Handle incoming messages (POST request)
    if (req.method === "POST") {
      const body = await req.json();
      console.log("Received webhook:", JSON.stringify(body, null, 2));

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Process each entry
      if (body.entry) {
        for (const entry of body.entry) {
          const changes = entry.changes || [];
          
          for (const change of changes) {
            if (change.field === "messages") {
              const value = change.value;
              const phoneNumberId = value.metadata?.phone_number_id;
              const messages = value.messages || [];
              const statuses = value.statuses || [];
              const contacts = value.contacts || [];

              // Find the WhatsApp account
              const { data: account } = await supabase
                .from("whatsapp_accounts")
                .select("*")
                .eq("phone_number_id", phoneNumberId)
                .single();

              if (!account) {
                console.log(`No account found for phone_number_id: ${phoneNumberId}`);
                continue;
              }

              // Process incoming messages
              for (const message of messages) {
                const from = message.from;
                const timestamp = message.timestamp;
                const messageType = message.type;
                const wamid = message.id;

                // Find or create conversation
                let { data: conversation } = await supabase
                  .from("whatsapp_conversations")
                  .select("*")
                  .eq("account_id", account.id)
                  .eq("customer_phone", from)
                  .single();

                if (!conversation) {
                  // Get contact name if available
                  const contact = contacts.find((c: any) => c.wa_id === from);
                  const customerName = contact?.profile?.name || null;

                  const { data: newConv, error: convError } = await supabase
                    .from("whatsapp_conversations")
                    .insert({
                      account_id: account.id,
                      customer_phone: from,
                      customer_name: customerName,
                      conversation_type: "user_initiated",
                      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                    })
                    .select()
                    .single();

                  if (convError) {
                    console.error("Error creating conversation:", convError);
                    continue;
                  }
                  conversation = newConv;
                }

                // Extract message content based on type
                let content = null;
                let mediaUrl = null;
                let mediaMimeType = null;

                switch (messageType) {
                  case "text":
                    content = message.text?.body;
                    break;
                  case "image":
                    content = message.image?.caption || "[Immagine]";
                    mediaUrl = message.image?.id;
                    mediaMimeType = message.image?.mime_type;
                    break;
                  case "video":
                    content = message.video?.caption || "[Video]";
                    mediaUrl = message.video?.id;
                    mediaMimeType = message.video?.mime_type;
                    break;
                  case "audio":
                    content = "[Audio]";
                    mediaUrl = message.audio?.id;
                    mediaMimeType = message.audio?.mime_type;
                    break;
                  case "document":
                    content = message.document?.filename || "[Documento]";
                    mediaUrl = message.document?.id;
                    mediaMimeType = message.document?.mime_type;
                    break;
                  case "location":
                    content = `[Posizione: ${message.location?.latitude}, ${message.location?.longitude}]`;
                    break;
                  case "contacts":
                    content = `[Contatto: ${message.contacts?.[0]?.name?.formatted_name || "Sconosciuto"}]`;
                    break;
                  case "sticker":
                    content = "[Sticker]";
                    mediaUrl = message.sticker?.id;
                    break;
                  case "reaction":
                    content = `[Reazione: ${message.reaction?.emoji}]`;
                    break;
                  case "interactive":
                    content = message.interactive?.button_reply?.title || 
                              message.interactive?.list_reply?.title ||
                              "[Risposta interattiva]";
                    break;
                  default:
                    content = `[${messageType}]`;
                }

                // Save the message
                const { error: msgError } = await supabase
                  .from("whatsapp_messages")
                  .insert({
                    conversation_id: conversation.id,
                    wamid: wamid,
                    direction: "inbound",
                    message_type: messageType,
                    content: content,
                    media_url: mediaUrl,
                    media_mime_type: mediaMimeType,
                    status: "received"
                  });

                if (msgError) {
                  console.error("Error saving message:", msgError);
                }

                // Update conversation
                await supabase
                  .from("whatsapp_conversations")
                  .update({
                    last_message_at: new Date(parseInt(timestamp) * 1000).toISOString(),
                    last_message_preview: content?.substring(0, 100),
                    unread_count: (conversation.unread_count || 0) + 1,
                    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                  })
                  .eq("id", conversation.id);
              }

              // Process status updates
              for (const status of statuses) {
                const wamid = status.id;
                const statusType = status.status; // sent, delivered, read, failed

                const updateData: any = { status: statusType };
                
                if (statusType === "delivered") {
                  updateData.delivered_at = new Date(parseInt(status.timestamp) * 1000).toISOString();
                } else if (statusType === "read") {
                  updateData.read_at = new Date(parseInt(status.timestamp) * 1000).toISOString();
                } else if (statusType === "failed") {
                  updateData.error_code = status.errors?.[0]?.code;
                  updateData.error_message = status.errors?.[0]?.message;
                }

                await supabase
                  .from("whatsapp_messages")
                  .update(updateData)
                  .eq("wamid", wamid);
              }
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Method not allowed", { status: 405 });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
