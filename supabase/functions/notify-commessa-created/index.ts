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
    const { commessa_title, commessa_type, deadline, customer_name } = await req.json();

    console.log("Notifying about new commessa:", { commessa_title, commessa_type, deadline, customer_name });

    // Get notification rules for nuova_commessa event
    const { data: rules, error: rulesError } = await supabase
      .from("zapp_notification_rules")
      .select("*")
      .eq("event_type", "nuova_commessa")
      .eq("is_active", true);

    if (rulesError) {
      console.error("Error fetching notification rules:", rulesError);
      throw rulesError;
    }

    if (!rules || rules.length === 0) {
      console.log("No active notification rules for nuova_commessa");
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

    if (!waAccount) {
      console.warn("No active Zapper WhatsApp account found");
      return new Response(
        JSON.stringify({ success: false, error: "No active WhatsApp account" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const typeLabels: Record<string, string> = {
      fornitura: "Fornitura",
      intervento: "Intervento",
      ricambi: "Ricambi",
    };
    const typeLabel = typeLabels[commessa_type] || commessa_type || "N/D";
    const deadlineFormatted = deadline
      ? new Date(deadline).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "Non specificata";

    const results: { name: string; success: boolean; error?: string }[] = [];

    // Process WhatsApp rules
    const waRules = rules.filter(r => r.channel === "whatsapp");
    for (const rule of waRules) {
      const phone = rule.recipient_phone;
      if (!phone) {
        results.push({ name: rule.recipient_name, success: false, error: "Nessun numero di telefono" });
        continue;
      }

      try {
        const templateParams = [
          rule.recipient_name,
          commessa_title || "Nuova commessa",
          typeLabel,
          deadlineFormatted,
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
              template_name: "nuova_commessa_notifica",
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

    // Process Email rules
    const emailRules = rules.filter(r => r.channel === "email");
    for (const rule of emailRules) {
      const email = rule.recipient_email;
      if (!email) {
        results.push({ name: rule.recipient_name, success: false, error: "Nessuna email" });
        continue;
      }

      try {
        await supabase.from("email_queue").insert({
          recipient_email: email,
          recipient_name: rule.recipient_name,
          subject: `Nuova Commessa: ${commessa_title || "Nuova commessa"}`,
          message: `È stata inserita una nuova commessa: ${commessa_title}\nTipologia: ${typeLabel}\nScadenza: ${deadlineFormatted}\nCliente: ${customer_name || "N/D"}`,
          html_content: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2 style="color:#667eea;">📋 Nuova Commessa</h2>
            <p><strong>${commessa_title || "Nuova commessa"}</strong></p>
            <ul>
              <li>📌 Tipologia: ${typeLabel}</li>
              <li>📅 Scadenza: ${deadlineFormatted}</li>
              <li>👤 Cliente: ${customer_name || "N/D"}</li>
            </ul>
            <p>Controlla il gestionale per i dettagli.</p>
          </div>`,
          sender_email: "noreply@abbattitorizapper.it",
          sender_name: "ERP Zapper",
          metadata: { type: "nuova_commessa" },
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
    console.error("Error in notify-commessa-created:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
