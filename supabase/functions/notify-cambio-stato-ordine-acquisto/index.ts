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
    const { order_number, new_status, supplier_name, order_date } = await req.json();

    console.log("Notifying about purchase order status change:", { order_number, new_status });

    const { data: rules, error: rulesError } = await supabase
      .from("zapp_notification_rules")
      .select("*")
      .eq("event_type", "cambio_stato_ordine_acquisto")
      .eq("is_active", true);

    if (rulesError) throw rulesError;
    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No active rules", results: [] }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: waAccount } = await supabase
      .from("whatsapp_accounts").select("id").eq("is_active", true).eq("pipeline", "Zapper").limit(1).single();

    const statusLabels: Record<string, string> = {
      draft: "Bozza", pending: "In Attesa", confirmed: "Confermato", in_progress: "In Corso",
      shipped: "Spedito", delivered: "Consegnato", completed: "Completato", cancelled: "Annullato",
    };
    const statusLabel = statusLabels[new_status] || new_status || "N/D";
    const dateFormatted = order_date ? new Date(order_date).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }) : new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });

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
              template_name: "cambio_stato_ordine_acquisto", template_language: "it",
              template_params: [rule.recipient_name, order_number || "OdA", statusLabel, supplier_name || "N/D", dateFormatted],
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
          subject: `Cambio Stato OdA: ${order_number || ""} → ${statusLabel}`,
          message: `L'ordine ${order_number} è passato a: ${statusLabel}\nFornitore: ${supplier_name}`,
          html_content: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2 style="color:#6366f1;">🔃 Cambio Stato Ordine Acquisto</h2>
            <p><strong>${order_number || "OdA"}</strong></p>
            <ul><li>🔄 Nuovo stato: ${statusLabel}</li><li>🏭 Fornitore: ${supplier_name || "N/D"}</li><li>📅 Data: ${dateFormatted}</li></ul>
            <p>Controlla il gestionale per i dettagli.</p></div>`,
          sender_email: "noreply@abbattitorizapper.it", sender_name: "ERP Zapper",
          metadata: { type: "cambio_stato_ordine_acquisto" },
        });
        results.push({ name: rule.recipient_name, success: true });
      } catch (err) { results.push({ name: rule.recipient_name, success: false, error: err.message }); }
    }

    return new Response(JSON.stringify({ success: true, results }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error in notify-cambio-stato-ordine-acquisto:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
