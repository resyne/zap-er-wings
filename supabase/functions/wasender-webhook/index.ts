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
    // NOTE: WaSender sends BOTH messages.upsert AND messages.received for the same message
    // We only handle messages.upsert to avoid duplicates
    switch (event) {
      case "messages.upsert": {
        // New incoming message - primary handler
        await handleIncomingMessage(supabase, payload.data, payload.sessionId);
        break;
      }
      case "messages.received":
      case "messages-personal.received": {
        // Skip - these are duplicate of messages.upsert
        console.log("Skipping duplicate event (handled via messages.upsert):", event);
        break;
      }
      case "message.status":
      case "message-receipt.update": {
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

// Helper function to normalize phone numbers
function normalizePhone(phone: string): string {
  if (!phone) return "";
  // Remove all non-numeric characters except leading +
  return phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
}

// Helper function to download and store media from WaSender
async function downloadAndStoreMedia(
  supabase: any, 
  mediaUrl: string, 
  messageType: string, 
  conversationId: string,
  wasenderId: string
): Promise<string | null> {
  try {
    // Skip if no URL or if it's already our storage URL
    if (!mediaUrl) return null;
    if (mediaUrl.includes("supabase.co/storage")) return mediaUrl;

    console.log(`Downloading media from: ${mediaUrl.substring(0, 100)}...`);

    // Try to download the media
    const response = await fetch(mediaUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      console.error(`Failed to download media: ${response.status} ${response.statusText}`);
      return null;
    }

    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Determine file extension based on message type and content type
    const contentType = response.headers.get("content-type") || "";
    let extension = "bin";
    
    if (messageType === "audio") {
      if (contentType.includes("ogg")) extension = "ogg";
      else if (contentType.includes("mp3")) extension = "mp3";
      else if (contentType.includes("mpeg")) extension = "mp3";
      else if (contentType.includes("webm")) extension = "webm";
      else if (contentType.includes("m4a")) extension = "m4a";
      else extension = "ogg"; // WhatsApp typically uses ogg for voice
    } else if (messageType === "image") {
      if (contentType.includes("jpeg") || contentType.includes("jpg")) extension = "jpg";
      else if (contentType.includes("png")) extension = "png";
      else if (contentType.includes("gif")) extension = "gif";
      else if (contentType.includes("webp")) extension = "webp";
      else extension = "jpg";
    } else if (messageType === "video") {
      if (contentType.includes("mp4")) extension = "mp4";
      else if (contentType.includes("webm")) extension = "webm";
      else extension = "mp4";
    } else if (messageType === "document") {
      if (contentType.includes("pdf")) extension = "pdf";
      else extension = "bin";
    }

    // Generate unique filename
    const fileName = `${Date.now()}-${wasenderId.substring(0, 8)}.${extension}`;
    const filePath = `${conversationId}/${fileName}`;

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from("wasender-media")
      .upload(filePath, uint8Array, {
        contentType: contentType || `${messageType}/${extension}`,
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading media to storage:", uploadError);
      return null;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from("wasender-media")
      .getPublicUrl(filePath);

    console.log(`Media saved to storage: ${publicUrl}`);
    return publicUrl;

  } catch (error) {
    console.error("Error downloading/storing media:", error);
    return null;
  }
}

async function handleIncomingMessage(supabase: any, data: any, sessionId?: string) {
  try {
    // WaSender format: data.messages is a single object (not array)
    const messageData = data.messages || data.message || data;
    const key = messageData.key || {};
    
    // Get wasender message ID for deduplication
    const wasenderId = key.id;
    if (!wasenderId) {
      console.error("No message ID found, skipping");
      return;
    }

    // Check if message already exists (deduplication)
    const { data: existingMsg } = await supabase
      .from("wasender_messages")
      .select("id")
      .eq("wasender_id", wasenderId)
      .maybeSingle();

    if (existingMsg) {
      console.log(`Message ${wasenderId} already exists, skipping duplicate`);
      return;
    }

    // Skip messages sent by us (fromMe = true)
    if (key.fromMe === true) {
      console.log("Skipping outbound message (fromMe=true)");
      return;
    }
    
    // Extract sender phone - use cleanedSenderPn for private chats, cleanedParticipantPn for groups
    const rawPhone = key.cleanedParticipantPn || key.cleanedSenderPn || 
                     key.remoteJid?.replace(/@s\.whatsapp\.net|@g\.us|@lid/g, "") || "";
    const senderPhone = normalizePhone(rawPhone);
    
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
    
    // Determine message type and extract media URL
    const rawMessage = messageData.message || {};
    let messageType = "text";
    let originalMediaUrl: string | null = null;

    if (rawMessage.imageMessage) {
      messageType = "image";
      originalMediaUrl = rawMessage.imageMessage.url || 
                 messageData.mediaUrl || 
                 messageData.media?.url ||
                 null;
    } else if (rawMessage.videoMessage) {
      messageType = "video";
      originalMediaUrl = rawMessage.videoMessage.url || 
                 messageData.mediaUrl || 
                 messageData.media?.url ||
                 null;
    } else if (rawMessage.audioMessage) {
      messageType = "audio";
      originalMediaUrl = rawMessage.audioMessage.url || 
                 messageData.mediaUrl || 
                 messageData.media?.url ||
                 null;
    } else if (rawMessage.documentMessage) {
      messageType = "document";
      originalMediaUrl = rawMessage.documentMessage.url || 
                 messageData.mediaUrl || 
                 messageData.media?.url ||
                 null;
    } else if (rawMessage.stickerMessage) {
      messageType = "sticker";
      originalMediaUrl = rawMessage.stickerMessage.url || 
                 messageData.mediaUrl || 
                 messageData.media?.url ||
                 null;
    }

    // Also check for top-level media fields (some WaSender versions)
    if (!originalMediaUrl && messageData.mediaUrl) {
      originalMediaUrl = messageData.mediaUrl;
    }
    if (!originalMediaUrl && messageData.media?.url) {
      originalMediaUrl = messageData.media.url;
    }
    if (!originalMediaUrl && messageData.media?.link) {
      originalMediaUrl = messageData.media.link;
    }

    // Get push name (sender's WhatsApp name)
    const pushName = messageData.pushName || key.pushName || null;

    console.log(`Processing incoming message from ${senderPhone}: ${messageContent.substring(0, 50)}...`);

    // Find matching account by session_id if provided, otherwise use first active
    let account = null;
    
    if (sessionId) {
      const { data: matchedAccount } = await supabase
        .from("wasender_accounts")
        .select("id, phone_number, session_id")
        .eq("session_id", sessionId)
        .eq("is_active", true)
        .maybeSingle();
      
      account = matchedAccount;
    }

    if (!account) {
      // Fallback to first active account
      const { data: accounts, error: accountError } = await supabase
        .from("wasender_accounts")
        .select("id, phone_number, session_id")
        .eq("is_active", true)
        .limit(1);

      if (accountError) {
        console.error("Error fetching accounts:", accountError);
        return;
      }

      if (!accounts || accounts.length === 0) {
        console.error("No active WaSender accounts found");
        return;
      }
      
      account = accounts[0];
    }

    // Find existing conversation - search with normalized phone
    // Try multiple formats to find existing conversation
    const phoneVariants = [
      senderPhone,
      `+${senderPhone}`,
      senderPhone.replace(/^0/, "39"), // Italian numbers
    ];

    let conversation = null;
    
    for (const phoneVariant of phoneVariants) {
      const { data: conv } = await supabase
        .from("wasender_conversations")
        .select("id, unread_count, customer_phone")
        .eq("account_id", account.id)
        .or(`customer_phone.eq.${phoneVariant},customer_phone.ilike.%${senderPhone.slice(-9)}`)
        .maybeSingle();
      
      if (conv) {
        conversation = conv;
        break;
      }
    }

    // Generate a temporary conversation ID for file storage (we'll update it after)
    const tempConversationId = conversation?.id || `temp-${Date.now()}`;

    // Download and store media if present
    let mediaUrl: string | null = null;
    if (originalMediaUrl && messageType !== "text") {
      mediaUrl = await downloadAndStoreMedia(
        supabase, 
        originalMediaUrl, 
        messageType, 
        tempConversationId,
        wasenderId
      );
    }

    if (!conversation) {
      // Create new conversation with appropriate preview
      const preview = messageContent ? messageContent.substring(0, 100) :
                     messageType === "audio" ? "🎵 Audio" :
                     messageType === "image" ? "📷 Immagine" :
                     messageType === "video" ? "🎬 Video" :
                     messageType === "document" ? "📄 Documento" :
                     messageType === "sticker" ? "🎨 Sticker" : "";
      
      const { data: newConv, error: createError } = await supabase
        .from("wasender_conversations")
        .insert({
          account_id: account.id,
          customer_phone: senderPhone,
          customer_name: pushName,
          status: "active",
          unread_count: 1,
          last_message_at: new Date().toISOString(),
          last_message_preview: preview
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
      // Update existing conversation with appropriate preview
      const preview = messageContent ? messageContent.substring(0, 100) :
                     messageType === "audio" ? "🎵 Audio" :
                     messageType === "image" ? "📷 Immagine" :
                     messageType === "video" ? "🎬 Video" :
                     messageType === "document" ? "📄 Documento" :
                     messageType === "sticker" ? "🎨 Sticker" : "";
      
      const { error: updateError } = await supabase
        .from("wasender_conversations")
        .update({ 
          unread_count: (conversation.unread_count || 0) + 1,
          last_message_at: new Date().toISOString(),
          last_message_preview: preview,
          customer_name: pushName || undefined // Update name if we have it
        })
        .eq("id", conversation.id);

      if (updateError) {
        console.error("Error updating conversation:", updateError);
      }
      console.log(`Updated existing conversation for ${senderPhone}`);
    }

    // Save the message with media URL if present
    const { error: msgError } = await supabase
      .from("wasender_messages")
      .insert({
        conversation_id: conversation.id,
        direction: "inbound",
        message_type: messageType,
        content: messageContent || null,
        media_url: mediaUrl,
        status: "received",
        wasender_id: wasenderId
      });

    if (msgError) {
      console.error("Error saving message:", msgError);
      return;
    }

    console.log(`Message saved successfully from ${senderPhone}, type: ${messageType}, has media: ${!!mediaUrl}`);

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
