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
    const { commessa_title, commessa_type, customer_name, deadline, days_remaining } = await req.json();

    console.log("Notifying about imminent deadline:", { commessa_title, deadline, days_remaining });

    const { data: rules, error: rulesError } = await supabase
      .from("zapp_notification_rules")
      .select("*")
      .eq("event_type", "scadenza_imminente")
      .eq("is_active", true);

    if (rulesError) throw rulesError;
    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No active rules", results: [] }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: waAccount } = await supabase
      .from("whatsapp_accounts").select("id").eq("is_active", true).eq("pipeline", "Zapper").limit(1).single();

    const typeLabels: Record<string, string> = { fornitura: "Fornitura", intervento: "Intervento", ricambi: "Ricambi" };
    const typeLabel = typeLabels[commessa_type] || commessa_type || "N/D";
    const deadlineFormatted = deadline ? new Date(deadline).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }) : "N/D";
    const daysStr = days_remaining !== undefined ? String(days_remaining) : "N/D";

    const results: { name: string; success: boolean; error?: string }[] = [];

    const waRules = rules.filter(r => r.channel === "whatsapp");
    if (waAccount) {
      for (const rule of waRules) {
        if (!rule.recipient_phone) { results.push({ name: rule.recipient_name, success: false, error: "Nessun numero" }); continue; }
        try {
          const waResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseServiceKey}` },
            body: JSON.stringify({
              account_id: waAccount.id, to: rule.recipient_phone, type: "template",
              template_name: "scadenza_imminente", template_language: "it",
              template_params: [rule.recipient_name, commessa_title || "Commessa", typeLabel, customer_name || "N/D", deadlineFormatted, daysStr],
            }),
          });
          const waResult = await waResponse.json();
          results.push({ name: rule.recipient_name, success: !!waResult.success, error: waResult.error });
        } catch (err) { results.push({ name: rule.recipient_name, success: false, error: err.message }); }
      }
    }

    for (const rule of rules.filter(r => r.channel === "email")) {
      if (!rule.recipient_email) { results.push({ name: rule.recipient_name, success: false, error: "Nessuna email" }); continue; }
      try {
        await supabase.from("email_queue").insert({
          recipient_email: rule.recipient_email, recipient_name: rule.recipient_name,
          subject: `⚠️ Scadenza Imminente: ${commessa_title || "Commessa"} (${daysStr} giorni)`,
          message: `La commessa ${commessa_title} scade il ${deadlineFormatted} (${daysStr} giorni)`,
          html_content: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2 style="color:#dc2626;">⏰ Scadenza Imminente</h2>
            <p><strong>${commessa_title || "Commessa"}</strong></p>
            <ul><li>📌 Tipologia: ${typeLabel}</li><li>👤 Cliente: ${customer_name || "N/D"}</li><li>📅 Scadenza: ${deadlineFormatted}</li><li>⏰ Giorni rimasti: ${daysStr}</li></ul>
            <p>Verifica lo stato sul gestionale.</p></div>`,
          sender_email: "noreply@abbattitorizapper.it", sender_name: "ERP Zapper",
          metadata: { type: "scadenza_imminente" },
        });
        results.push({ name: rule.recipient_name, success: true });
      } catch (err) { results.push({ name: rule.recipient_name, success: false, error: err.message }); }
    }

    return new Response(JSON.stringify({ success: true, results }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error in notify-scadenza-imminente:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
