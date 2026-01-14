import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH_API_VERSION = "v18.0";
const GRAPH_API_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface SendMessageRequest {
  account_id: string;
  to: string;
  type: "text" | "template" | "image" | "document" | "audio" | "video";
  content?: string;
  template_name?: string;
  template_language?: string;
  template_params?: any[];
  media_url?: string;
  media_caption?: string;
  header_document_url?: string; // URL del documento per header template
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: SendMessageRequest = await req.json();
    const { account_id, to, type, content, template_name, template_language, template_params, media_url, media_caption, header_document_url } = body;

    // Get account details
    const { data: account, error: accountError } = await supabase
      .from("whatsapp_accounts")
      .select("*")
      .eq("id", account_id)
      .single();

    if (accountError || !account) {
      throw new Error("Account not found");
    }

    if (!account.access_token) {
      throw new Error("Access token not configured for this account");
    }

    // Normalize phone number
    const recipientPhone = to.replace(/\D/g, "");

    // Build message payload
    let messagePayload: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientPhone,
    };

    switch (type) {
      case "text":
        messagePayload.type = "text";
        messagePayload.text = {
          preview_url: true,
          body: content,
        };
        break;

      case "template":
        messagePayload.type = "template";
        messagePayload.template = {
          name: template_name,
          language: {
            code: template_language || "it",
          },
        };
        
        // Build components array
        const components: any[] = [];
        
        // Add header component if document URL is provided
        if (header_document_url) {
          components.push({
            type: "header",
            parameters: [
              {
                type: "document",
                document: {
                  link: header_document_url
                }
              }
            ]
          });
        }
        
        // Add body parameters if provided
        if (template_params && template_params.length > 0) {
          components.push({
            type: "body",
            parameters: template_params.map((param) => ({
              type: "text",
              text: param,
            })),
          });
        }
        
        // Only add components if there are any
        if (components.length > 0) {
          messagePayload.template.components = components;
        }
        break;

      case "image":
        messagePayload.type = "image";
        messagePayload.image = {
          link: media_url,
          caption: media_caption,
        };
        break;

      case "document":
        messagePayload.type = "document";
        messagePayload.document = {
          link: media_url,
          caption: media_caption,
        };
        break;

      case "audio":
        messagePayload.type = "audio";
        messagePayload.audio = {
          link: media_url,
        };
        break;

      case "video":
        messagePayload.type = "video";
        messagePayload.video = {
          link: media_url,
          caption: media_caption,
        };
        break;

      default:
        throw new Error(`Unsupported message type: ${type}`);
    }

    console.log("Sending message:", JSON.stringify(messagePayload, null, 2));

    // Send message via Meta Graph API
    const response = await fetch(
      `${GRAPH_API_URL}/${account.phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messagePayload),
      }
    );

    const result = await response.json();
    console.log("Meta API response:", JSON.stringify(result, null, 2));

    if (!response.ok) {
      throw new Error(result.error?.message || "Failed to send message");
    }

    const wamid = result.messages?.[0]?.id;

    // Find or create conversation
    let { data: conversation } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .eq("account_id", account_id)
      .eq("customer_phone", recipientPhone)
      .single();

    if (!conversation) {
      const { data: newConv, error: convError } = await supabase
        .from("whatsapp_conversations")
        .insert({
          account_id: account_id,
          customer_phone: recipientPhone,
          conversation_type: "business_initiated",
        })
        .select()
        .single();

      if (convError) {
        console.error("Error creating conversation:", convError);
      } else {
        conversation = newConv;
      }
    }

    // Save message to database
    if (conversation) {
      let messageContent = type === "template" ? `[Template: ${template_name}]` : content;
      if (header_document_url) {
        messageContent += ` [+Documento]`;
      }
      
      await supabase.from("whatsapp_messages").insert({
        conversation_id: conversation.id,
        wamid: wamid,
        direction: "outbound",
        message_type: type,
        content: messageContent,
        template_name: template_name,
        template_params: template_params,
        media_url: header_document_url || media_url,
        status: "sent",
      });

      // Update conversation
      await supabase
        .from("whatsapp_conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: messageContent?.substring(0, 100),
        })
        .eq("id", conversation.id);
    }

    // Calcolo automatico costi Meta (pricing Italia EUR)
    // Marketing: €0.0485, Utility: €0.0200, Authentication: €0.0415, Service: gratis
    let conversationType = "service";
    let creditCost = 0;
    
    if (type === "template") {
      // Determina il tipo di conversazione dal template category (se disponibile)
      // Di default per template = marketing
      conversationType = "marketing";
      creditCost = 0.0485;
    } else {
      // Messaggi di risposta in una finestra di servizio sono gratuiti
      conversationType = "service";
      creditCost = 0;
    }

    // Salva il tracking dei costi (senza modificare credits_balance)
    if (creditCost > 0) {
      await supabase.from("whatsapp_credit_transactions").insert({
        account_id: account_id,
        amount: -creditCost,
        transaction_type: "message_sent",
        conversation_type: conversationType,
        balance_after: null, // Non tracciamo più il saldo
        notes: `Messaggio ${type} a ${recipientPhone}`,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_id: wamid,
        conversation_id: conversation?.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Send message error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
