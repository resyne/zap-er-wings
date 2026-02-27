import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { commessa_title, commessa_number, phase_type, scheduled_date, customer_name, is_reschedule } = await req.json();

    console.log("Notifying about commessa scheduling:", { commessa_title, phase_type, scheduled_date, is_reschedule });

    // Get notification rules for calendarizzazione_commessa event
    const { data: rules, error: rulesError } = await supabase
      .from("zapp_notification_rules")
      .select("*")
      .eq("event_type", "calendarizzazione_commessa")
      .eq("is_active", true);

    if (rulesError) {
      console.error("Error fetching notification rules:", rulesError);
      throw rulesError;
    }

    if (!rules || rules.length === 0) {
      console.log("No active notification rules for calendarizzazione_commessa");
      return new Response(
        JSON.stringify({ success: true, message: "No active rules", results: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get first active Zapper WhatsApp account
    const { data: waAccount } = await supabase
      .from("whatsapp_accounts")
      .select("id")
      .eq("is_active", true)
      .eq("pipeline", "Zapper")
      .limit(1)
      .single();

    const phaseLabels: Record<string, string> = {
      produzione: "Produzione",
      spedizione: "Spedizione",
      installazione: "Installazione",
    };
    const phaseLabel = phaseLabels[phase_type] || phase_type || "N/D";
    const dateFormatted = scheduled_date
      ? new Date(scheduled_date).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "Non specificata";
    const actionLabel = is_reschedule ? "riprogrammata" : "calendarizzata";

    const results: { name: string; success: boolean; error?: string }[] = [];

    // Process WhatsApp rules
    const waRules = rules.filter(r => r.channel === "whatsapp");
    if (waAccount) {
      for (const rule of waRules) {
        const phone = rule.recipient_phone;
        if (!phone) {
          results.push({ name: rule.recipient_name, success: false, error: "Nessun numero di telefono" });
          continue;
        }

        try {
          // Use different template based on reschedule vs first scheduling
          // data_calendarizzata: {{1}} nome, {{2}} commessa, {{3}} fase, {{4}} data, {{5}} cliente
          // data_ricalendarizzata: {{1}} nome, {{2}} commessa, {{3}} fase, {{4}} data, {{5}} cliente
          const templateName = is_reschedule ? "data_ricalendarizzata" : "data_calendarizzata";
          const templateParams = [
            rule.recipient_name,
            commessa_number || commessa_title || "N/D",
            phaseLabel,
            dateFormatted,
            customer_name || "N/D",
          ];

          const waResponse = await fetch(
            `${supabaseUrl}/functions/v1/whatsapp-send`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                account_id: waAccount.id,
                to: phone,
                type: "template",
                template_name: templateName,
                template_language: "it",
                template_params: templateParams,
              }),
            }
          );

          const waResult = await waResponse.json();
          if (waResult.success) {
            console.log(`WhatsApp sent to ${rule.recipient_name} (${phone})`);
            results.push({ name: rule.recipient_name, success: true });
          } else {
            console.error(`WhatsApp failed for ${rule.recipient_name}:`, waResult.error);
            results.push({ name: rule.recipient_name, success: false, error: waResult.error });
          }
        } catch (err) {
          console.error(`Error sending to ${rule.recipient_name}:`, err);
          results.push({ name: rule.recipient_name, success: false, error: err.message });
        }
      }
    } else {
      console.warn("No active Zapper WhatsApp account found");
      for (const rule of waRules) {
        results.push({ name: rule.recipient_name, success: false, error: "No WhatsApp account" });
      }
    }

    // Process Email rules
    const emailRules = rules.filter(r => r.channel === "email");
    for (const rule of emailRules) {
      const email = rule.recipient_email;
      if (!email) {
        results.push({ name: rule.recipient_name, success: false, error: "Nessuna email" });
        continue;
      }

      try {
        const subjectPrefix = is_reschedule ? "Riprogrammazione" : "Calendarizzazione";
        await supabase.from("email_queue").insert({
          recipient_email: email,
          recipient_name: rule.recipient_name,
          subject: `${subjectPrefix}: ${commessa_number || commessa_title || "Commessa"}`,
          message: `La fase ${phaseLabel} della commessa ${commessa_number || commessa_title} è stata ${actionLabel} per il ${dateFormatted}.\nCliente: ${customer_name || "N/D"}`,
          html_content: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2 style="color:#667eea;">📅 ${subjectPrefix} Commessa</h2>
            <p><strong>${commessa_number || commessa_title || "Commessa"}</strong></p>
            <ul>
              <li>📌 Fase: ${phaseLabel}</li>
              <li>📅 Data: ${dateFormatted}</li>
              <li>👤 Cliente: ${customer_name || "N/D"}</li>
              <li>🔄 Azione: ${is_reschedule ? "Data modificata" : "Nuova calendarizzazione"}</li>
            </ul>
            <p>Controlla il gestionale per i dettagli.</p>
          </div>`,
          sender_email: "noreply@abbattitorizapper.it",
          sender_name: "ERP Zapper",
          metadata: { type: "calendarizzazione_commessa" },
        });
        results.push({ name: rule.recipient_name, success: true });
      } catch (err) {
        results.push({ name: rule.recipient_name, success: false, error: err.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in notify-commessa-scheduled:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
