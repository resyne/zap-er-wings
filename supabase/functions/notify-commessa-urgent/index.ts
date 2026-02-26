import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface NotifyRequest {
  type: "priority_change" | "urgent_message";
  commessa_id: string;
  commessa_number: string;
  commessa_title: string;
  commessa_type: string;
  customer_name?: string;
  deadline?: string;
  // For priority change
  old_priority?: string;
  new_priority?: string;
  // For urgent message
  message?: string;
  // Sender info
  sender_id?: string;
}

const priorityLabels: Record<string, string> = {
  low: "Bassa", medium: "Media", high: "Alta", urgent: "Urgente",
};

const typeLabels: Record<string, string> = {
  fornitura: "Fornitura", intervento: "Intervento", ricambi: "Ricambi",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: NotifyRequest = await req.json();

    console.log("Commessa urgent notification:", body.type, body.commessa_number);

    // Determine which event_type to use for notification rules
    const eventType = body.type === "priority_change" 
      ? "cambio_priorita_commessa" 
      : "comunicazione_urgente_commessa";

    // Get notification rules - fallback to cambio_stato_commessa rules if specific ones don't exist
    let { data: rules } = await supabase
      .from("zapp_notification_rules")
      .select("*")
      .eq("event_type", eventType)
      .eq("is_active", true);

    // If no specific rules, fallback to cambio_stato_commessa rules
    if (!rules || rules.length === 0) {
      const { data: fallbackRules } = await supabase
        .from("zapp_notification_rules")
        .select("*")
        .eq("event_type", "cambio_stato_commessa")
        .eq("is_active", true);
      rules = fallbackRules || [];
    }

    if (rules.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No active rules", results: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Zapper WhatsApp account
    const { data: waAccount } = await supabase
      .from("whatsapp_accounts")
      .select("id")
      .eq("is_active", true)
      .eq("pipeline", "Zapper")
      .limit(1)
      .single();

    const typeLabel = typeLabels[body.commessa_type] || body.commessa_type || "N/D";
    const deadlineFormatted = body.deadline
      ? new Date(body.deadline).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "Non specificata";

    const results: { name: string; channel: string; success: boolean; error?: string }[] = [];
    const sentVia: string[] = [];
    const sentTo: string[] = [];

    // Build content based on type
    let emailSubject: string;
    let emailBody: string;
    let templateName: string;
    let templateParams: string[];

    if (body.type === "priority_change") {
      const oldLabel = priorityLabels[body.old_priority || ""] || body.old_priority || "N/D";
      const newLabel = priorityLabels[body.new_priority || ""] || body.new_priority || "N/D";
      
      emailSubject = `⚠️ Cambio Priorità: ${body.commessa_number} → ${newLabel}`;
      emailBody = `La priorità della commessa ${body.commessa_number} (${body.commessa_title}) è stata cambiata da ${oldLabel} a ${newLabel}.`;
      templateName = "cambio_priorita_commessa";
      // Template params: recipient_name, commessa_number, old_priority, new_priority, type, customer, deadline
      templateParams = []; // Will be set per-recipient
    } else {
      emailSubject = `🚨 Comunicazione Urgente: ${body.commessa_number}`;
      emailBody = body.message || "";
      templateName = "comunicazione_urgente_commessa";
      templateParams = [];
    }

    // WhatsApp rules
    const waRules = rules.filter(r => r.channel === "whatsapp");
    if (waAccount && waRules.length > 0) {
      for (const rule of waRules) {
        if (!rule.recipient_phone) {
          results.push({ name: rule.recipient_name, channel: "whatsapp", success: false, error: "Nessun numero" });
          continue;
        }
        try {
          let params: string[];
          if (body.type === "priority_change") {
            params = [
              rule.recipient_name,
              body.commessa_number,
              priorityLabels[body.old_priority || ""] || "N/D",
              priorityLabels[body.new_priority || ""] || "N/D",
              typeLabel,
              body.customer_name || "N/D",
              deadlineFormatted,
            ];
          } else {
            params = [
              rule.recipient_name,
              body.commessa_number,
              body.commessa_title || "Commessa",
              body.message || "Nessun messaggio",
              body.customer_name || "N/D",
            ];
          }

          const waResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseServiceKey}` },
            body: JSON.stringify({
              account_id: waAccount.id,
              to: rule.recipient_phone,
              type: "template",
              template_name: templateName,
              template_language: "it",
              template_params: params,
            }),
          });

          const waResult = await waResponse.json();
          const success = !!waResult.success;
          results.push({ name: rule.recipient_name, channel: "whatsapp", success, error: waResult.error });
          if (success) {
            if (!sentVia.includes("whatsapp")) sentVia.push("whatsapp");
            if (!sentTo.includes(rule.recipient_name)) sentTo.push(rule.recipient_name);
          }
        } catch (err) {
          results.push({ name: rule.recipient_name, channel: "whatsapp", success: false, error: err.message });
        }
      }
    }

    // Email rules
    const emailRules = rules.filter(r => r.channel === "email");
    for (const rule of emailRules) {
      if (!rule.recipient_email) {
        results.push({ name: rule.recipient_name, channel: "email", success: false, error: "Nessuna email" });
        continue;
      }
      try {
        let htmlContent: string;
        if (body.type === "priority_change") {
          const oldLabel = priorityLabels[body.old_priority || ""] || body.old_priority || "N/D";
          const newLabel = priorityLabels[body.new_priority || ""] || body.new_priority || "N/D";
          const priorityColor = body.new_priority === "urgent" ? "#dc2626" : body.new_priority === "high" ? "#ea580c" : "#f59e0b";
          
          htmlContent = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2 style="color:${priorityColor};">⚠️ Cambio Priorità Commessa</h2>
            <p><strong>${body.commessa_number}</strong> - ${body.commessa_title}</p>
            <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin:16px 0;">
              <p style="margin:0;">Priorità: <span style="text-decoration:line-through;color:#9ca3af;">${oldLabel}</span> → <strong style="color:${priorityColor};">${newLabel}</strong></p>
            </div>
            <ul><li>📌 Tipologia: ${typeLabel}</li><li>👤 Cliente: ${body.customer_name || "N/D"}</li><li>📅 Scadenza: ${deadlineFormatted}</li></ul>
            <p>Controlla il gestionale per i dettagli.</p></div>`;
        } else {
          htmlContent = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2 style="color:#dc2626;">🚨 Comunicazione Urgente</h2>
            <p><strong>${body.commessa_number}</strong> - ${body.commessa_title}</p>
            <div style="background:#fef2f2;padding:16px;border-radius:8px;border-left:4px solid #dc2626;margin:16px 0;">
              <p style="margin:0;font-size:16px;">${body.message || ""}</p>
            </div>
            <ul><li>📌 Tipologia: ${typeLabel}</li><li>👤 Cliente: ${body.customer_name || "N/D"}</li><li>📅 Scadenza: ${deadlineFormatted}</li></ul>
            <p>Controlla il gestionale per i dettagli.</p></div>`;
        }

        await supabase.from("email_queue").insert({
          recipient_email: rule.recipient_email,
          recipient_name: rule.recipient_name,
          subject: emailSubject,
          message: emailBody,
          html_content: htmlContent,
          sender_email: "noreply@abbattitorizapper.it",
          sender_name: "ERP Zapper",
          metadata: { type: body.type, commessa_id: body.commessa_id },
        });
        results.push({ name: rule.recipient_name, channel: "email", success: true });
        if (!sentVia.includes("email")) sentVia.push("email");
        if (!sentTo.includes(rule.recipient_name)) sentTo.push(rule.recipient_name);
      } catch (err) {
        results.push({ name: rule.recipient_name, channel: "email", success: false, error: err.message });
      }
    }

    // Log the communication
    await supabase.from("commessa_communications").insert({
      commessa_id: body.commessa_id,
      communication_type: body.type,
      content: body.type === "urgent_message" ? body.message : null,
      old_value: body.type === "priority_change" ? body.old_priority : null,
      new_value: body.type === "priority_change" ? body.new_priority : null,
      sent_via: sentVia,
      sent_to: sentTo,
      sent_by: body.sender_id || null,
      metadata: { results },
    });

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in notify-commessa-urgent:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
