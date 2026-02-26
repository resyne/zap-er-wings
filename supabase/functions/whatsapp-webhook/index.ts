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
            // Handle message_template_status_update for template status changes
            if (change.field === "message_template_status_update") {
              const templateUpdate = change.value;
              console.log("Template status update:", JSON.stringify(templateUpdate, null, 2));
              
              const { event, message_template_id, message_template_name, message_template_language, reason } = templateUpdate;
              
              // Map Meta events to our status
              let newStatus = "PENDING";
              let rejectionReason = null;
              
              switch (event) {
                case "APPROVED":
                  newStatus = "APPROVED";
                  break;
                case "REJECTED":
                  newStatus = "REJECTED";
                  rejectionReason = reason || "Template rifiutato da Meta";
                  break;
                case "PENDING":
                case "PENDING_DELETION":
                  newStatus = "PENDING";
                  break;
                case "DISABLED":
                  newStatus = "DISABLED";
                  break;
                case "PAUSED":
                  newStatus = "PAUSED";
                  break;
                case "IN_APPEAL":
                  newStatus = "IN_APPEAL";
                  break;
              }
              
              // Update template in database
              const { error: updateError } = await supabase
                .from("whatsapp_templates")
                .update({
                  status: newStatus,
                  rejection_reason: rejectionReason,
                  updated_at: new Date().toISOString()
                })
                .eq("meta_template_id", message_template_id);
              
              if (updateError) {
                console.error("Error updating template status:", updateError);
                // Try matching by name and language as fallback
                await supabase
                  .from("whatsapp_templates")
                  .update({
                    status: newStatus,
                    rejection_reason: rejectionReason,
                    updated_at: new Date().toISOString()
                  })
                  .eq("name", message_template_name)
                  .eq("language", message_template_language);
              }
              
              console.log(`Template ${message_template_name} status updated to ${newStatus}`);
              continue;
            }
            
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

                // Find or create conversation - try exact match first, then fuzzy match by last 9 digits
                let { data: conversation } = await supabase
                  .from("whatsapp_conversations")
                  .select("*")
                  .eq("account_id", account.id)
                  .eq("customer_phone", from)
                  .single();

                // If no exact match, try matching by last 9 digits (handles country code differences)
                if (!conversation) {
                  const fromDigits = from.replace(/\D/g, '');
                  const lastDigits = fromDigits.length >= 9 ? fromDigits.slice(-9) : fromDigits;
                  
                  const { data: allConvs } = await supabase
                    .from("whatsapp_conversations")
                    .select("*")
                    .eq("account_id", account.id)
                    .order("last_message_at", { ascending: false });
                  
                  if (allConvs) {
                    conversation = allConvs.find((c: any) => {
                      const cDigits = (c.customer_phone || '').replace(/\D/g, '');
                      const cLast = cDigits.length >= 9 ? cDigits.slice(-9) : cDigits;
                      return cLast === lastDigits;
                    }) || null;
                    
                    // Update the conversation's phone to the canonical Meta format
                    if (conversation && conversation.customer_phone !== from) {
                      console.log(`Updating conversation phone from ${conversation.customer_phone} to ${from}`);
                      await supabase
                        .from("whatsapp_conversations")
                        .update({ customer_phone: from })
                        .eq("id", conversation.id);
                      conversation.customer_phone = from;
                    }
                  }
                }

                if (!conversation) {
                  // Get contact name if available
                  const contact = contacts.find((c: any) => c.wa_id === from);
                  const customerName = contact?.profile?.name || null;

                  // Try to find a matching lead by phone number (last 9 digits)
                  let matchedLeadId: string | null = null;
                  try {
                    const phoneDigits = from.replace(/\D/g, '');
                    const searchPattern = phoneDigits.length >= 9 ? phoneDigits.slice(-9) : phoneDigits.slice(-8);
                    if (searchPattern) {
                      const { data: candidates } = await supabase.rpc(
                        'find_lead_by_normalized_phone',
                        { search_pattern: searchPattern }
                      );
                      if (candidates && candidates.length > 0) {
                        // Filter by pipeline if account has one
                        const pipeline = account.pipeline;
                        if (pipeline) {
                          const { data: pipelineLeads } = await supabase
                            .from('leads')
                            .select('id')
                            .in('id', candidates.map((c: any) => c.id))
                            .eq('pipeline', pipeline)
                            .limit(1);
                          if (pipelineLeads && pipelineLeads.length > 0) {
                            matchedLeadId = pipelineLeads[0].id;
                          }
                        } else {
                          matchedLeadId = candidates[0].id;
                        }
                      }
                    }
                  } catch (e) {
                    console.error("Error matching lead by phone:", e);
                  }

                  const { data: newConv, error: convError } = await supabase
                    .from("whatsapp_conversations")
                    .insert({
                      account_id: account.id,
                      customer_phone: from,
                      customer_name: customerName,
                      lead_id: matchedLeadId,
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
                  if (matchedLeadId) {
                    console.log(`Linked conversation to lead ${matchedLeadId}`);
                  }
                }

                // Extract message content based on type
                let content = null;
                let mediaUrl = null;
                let mediaMimeType = null;

                switch (messageType) {
                  case "text":
                    content = message.text?.body;
                    break;
                  case "button":
                    // Quick reply / button reply (older webhook format)
                    content = message.button?.text || message.button?.payload || "[Pulsante]";
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

                // Send notifications to configured users
                await sendNotifications(
                  supabase,
                  account,
                  from,
                  conversation.customer_name || contacts.find((c: any) => c.wa_id === from)?.profile?.name,
                  content || `[${messageType}]`,
                  messageType,
                  conversation.id
                );
                
                // Handle button reply triggers for automation
                if (messageType === "button" || messageType === "interactive") {
                  const buttonText = messageType === "button" 
                    ? (message.button?.text || message.button?.payload)
                    : (message.interactive?.button_reply?.title || message.interactive?.list_reply?.title);
                  
                  if (buttonText) {
                    console.log(`Button reply received: "${buttonText}" from ${from}`);
                    await handleButtonReplyTrigger(supabase, conversation, from, buttonText);
                  }
                }
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

// Handle button reply triggers for conditional automation steps
async function handleButtonReplyTrigger(
  supabase: any,
  conversation: any,
  customerPhone: string,
  buttonText: string
) {
  try {
    // Find the lead by phone
    const normalizedPhone = customerPhone.replace(/\D/g, '');
    const { data: leads } = await supabase
      .from("leads")
      .select("id")
      .or(`phone.ilike.%${normalizedPhone}%,phone.ilike.%${customerPhone}%`);
    
    if (!leads || leads.length === 0) {
      console.log(`No lead found for phone: ${customerPhone}`);
      return;
    }
    
    const leadId = leads[0].id;
    console.log(`Found lead ${leadId} for phone ${customerPhone}`);
    
    // Find sent executions for this lead that have conditional follow-up steps
    const { data: sentExecutions } = await supabase
      .from("whatsapp_automation_executions")
      .select(`
        id,
        lead_id,
        campaign_id,
        step_id,
        step:whatsapp_automation_steps(id, step_order, campaign_id)
      `)
      .eq("lead_id", leadId)
      .eq("status", "sent")
      .order("sent_at", { ascending: false });
    
    if (!sentExecutions || sentExecutions.length === 0) {
      console.log(`No sent executions found for lead ${leadId}`);
      return;
    }
    
    // For each sent execution, check if there are conditional steps waiting for this button reply
    for (const sentExec of sentExecutions) {
      // Find conditional steps that trigger from this step
      const { data: conditionalSteps } = await supabase
        .from("whatsapp_automation_steps")
        .select("*")
        .eq("trigger_from_step_id", sentExec.step_id)
        .eq("trigger_type", "button_reply")
        .eq("is_active", true);
      
      if (!conditionalSteps || conditionalSteps.length === 0) {
        continue;
      }
      
      for (const condStep of conditionalSteps) {
        // Check if button text matches (if specified) or accept any button
        const triggerButtonText = condStep.trigger_button_text?.trim().toLowerCase();
        const receivedButtonText = buttonText.trim().toLowerCase();
        
        // If trigger_button_text is empty or null, accept any button reply
        // Otherwise, check for a match
        const shouldTrigger = !triggerButtonText || 
                               triggerButtonText === receivedButtonText ||
                               receivedButtonText.includes(triggerButtonText);
        
        if (!shouldTrigger) {
          console.log(`Button text "${buttonText}" doesn't match trigger "${condStep.trigger_button_text}"`);
          continue;
        }
        
        // Check if execution already exists for this step
        const { data: existingExec } = await supabase
          .from("whatsapp_automation_executions")
          .select("id")
          .eq("lead_id", leadId)
          .eq("step_id", condStep.id)
          .limit(1);
        
        if (existingExec && existingExec.length > 0) {
          console.log(`Execution already exists for conditional step ${condStep.id}`);
          continue;
        }
        
        // Create the conditional execution - schedule immediately
        const scheduledFor = new Date();
        scheduledFor.setDate(scheduledFor.getDate() + (condStep.delay_days || 0));
        scheduledFor.setHours(scheduledFor.getHours() + (condStep.delay_hours || 0));
        scheduledFor.setMinutes(scheduledFor.getMinutes() + (condStep.delay_minutes || 0));
        
        const { error: insertError } = await supabase
          .from("whatsapp_automation_executions")
          .insert({
            lead_id: leadId,
            campaign_id: sentExec.campaign_id,
            step_id: condStep.id,
            status: "pending",
            scheduled_for: scheduledFor.toISOString()
          });
        
        if (insertError) {
          console.error("Error creating conditional execution:", insertError);
        } else {
          console.log(`Created conditional execution for step ${condStep.id} (template: ${condStep.template_name})`);
        }
      }
    }
  } catch (error) {
    console.error("Error handling button reply trigger:", error);
  }
}

// Send notifications based on user presence
async function sendNotifications(
  supabase: any,
  account: any,
  customerPhone: string,
  customerName: string | null,
  messageContent: string,
  messageType: string,
  conversationId?: string
) {
  try {
    // Fetch lead data and recent messages for email context
    let leadData: any = null;
    let recentMessages: any[] = [];
    let assignedUserId: string | null = null;

    if (conversationId) {
      // Get conversation with lead info and assigned user
      const { data: conversation } = await supabase
        .from("whatsapp_conversations")
        .select("lead_id, customer_name, assigned_user_id")
        .eq("id", conversationId)
        .single();

      if (conversation?.assigned_user_id) {
        assignedUserId = conversation.assigned_user_id;
      }

      if (conversation?.lead_id) {
        const { data: lead } = await supabase
          .from("leads")
          .select("id, contact_name, company_name, email, phone, country")
          .eq("id", conversation.lead_id)
          .single();
        
        if (lead) {
          leadData = lead;
        }
      }

      // Get recent messages for context (last 5 messages)
      const { data: messages } = await supabase
        .from("whatsapp_messages")
        .select("direction, content, created_at, message_type")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (messages && messages.length > 0) {
        recentMessages = messages.reverse().map((m: any) => ({
          direction: m.direction,
          content: m.content || "[Media]",
          timestamp: m.created_at,
          message_type: m.message_type
        }));
      }
    }

    // Determine recipients: if assigned user exists, notify only them;
    // otherwise fall back to the account-level notification settings
    let recipients: any[] = [];

    if (assignedUserId) {
      // Get presence info for assigned user
      const { data: presence } = await supabase
        .from("user_presence")
        .select("is_online")
        .eq("user_id", assignedUserId)
        .single();

      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", assignedUserId)
        .single();

      recipients = [{
        user_id: assignedUserId,
        email: profile?.email,
        is_online: presence?.is_online || false
      }];
      console.log(`Notifying assigned user ${assignedUserId}`);
    } else {
      // Fallback to account-level notification recipients
      const { data: accountRecipients, error } = await supabase
        .rpc("get_whatsapp_notification_recipients", { p_account_id: account.id });

      if (error) {
        console.error("Error getting notification recipients:", error);
        return;
      }
      recipients = accountRecipients || [];
    }

    if (recipients.length === 0) {
      console.log("No notification recipients for this conversation/account");
      return;
    }

    console.log(`Sending notifications to ${recipients.length} recipient(s)`);

    for (const recipient of recipients) {
      if (recipient.is_online) {
        // User is online - create in-app notification
        console.log(`Creating in-app notification for user ${recipient.user_id}`);
        
        await supabase.from("notifications").insert({
          user_id: recipient.user_id,
          title: `📱 Messaggio WhatsApp`,
          message: `${leadData?.contact_name || customerName || customerPhone}: ${messageContent.substring(0, 100)}`,
          type: "whatsapp_message",
          entity_type: "whatsapp_conversation",
          entity_id: conversationId || null,
          is_read: false,
        });
      } else {
        // User is offline - check email preference
        let shouldSendEmail = true;

        if (!assignedUserId) {
          // For account-level recipients, check their email_when_offline setting
          const { data: setting } = await supabase
            .from("whatsapp_notification_settings")
            .select("email_when_offline")
            .eq("account_id", account.id)
            .eq("user_id", recipient.user_id)
            .single();
          shouldSendEmail = setting?.email_when_offline ?? false;
        }

        if (shouldSendEmail && recipient.email) {
          console.log(`Sending email notification to ${recipient.email} with lead context`);
          
          const response = await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-whatsapp-notification-email`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                recipient_email: recipient.email,
                customer_phone: customerPhone,
                customer_name: customerName,
                lead_name: leadData?.contact_name,
                company_name: leadData?.company_name,
                message_content: messageContent,
                message_type: messageType,
                account_name: account.verified_name || account.display_phone_number,
                recent_messages: recentMessages,
              }),
            }
          );

          if (!response.ok) {
            console.error("Error sending notification email:", await response.text());
          }
        }
      }
    }
  } catch (error) {
    console.error("Error sending notifications:", error);
  }
}
