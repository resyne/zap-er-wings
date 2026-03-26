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
    const { report_number, customer_name, technician_name, technician_phone, intervention_date, notes } = await req.json();

    console.log("Notifying about new service report:", { report_number, customer_name, technician_name, intervention_date });

    // Get notification rules for nuovo_rapporto_intervento event
    const { data: rules, error: rulesError } = await supabase
      .from("zapp_notification_rules")
      .select("*")
      .eq("event_type", "nuovo_rapporto_intervento")
      .eq("is_active", true);

    if (rulesError) {
      console.error("Error fetching notification rules:", rulesError);
      throw rulesError;
    }

    if (!rules || rules.length === 0) {
      console.log("No active notification rules for nuovo_rapporto_intervento");
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

    const dateFormatted = intervention_date
      ? new Date(intervention_date).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "Non specificata";

    const sanitize = (text: string, maxLen = 200): string => {
      if (!text) return "-";
      return text.replace(/\n+/g, " ").replace(/\s+/g, " ").trim().substring(0, maxLen);
    };

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
          // Use nuova_commessa_notifica template with adapted params since no specific template exists yet
          // Params: recipient_name, title, type, date, customer
          const templateParams = [
            rule.recipient_name,
            sanitize(`Rapporto ${report_number || "N/D"} - ${sanitize(technician_name, 50)}`),
            "Rapporto di Intervento",
            dateFormatted,
            sanitize(customer_name) || "N/D",
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
    } else {
      console.warn("No active Zapper WhatsApp account found, skipping WhatsApp notifications");
      for (const rule of waRules) {
        results.push({ name: rule.recipient_name, success: false, error: "No active WhatsApp account" });
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
          subject: `Nuovo Rapporto di Intervento: ${report_number || "N/D"} - ${sanitize(customer_name, 50)}`,
          message: `È stato compilato un nuovo rapporto di intervento.\nNumero: ${report_number}\nCliente: ${customer_name || "N/D"}\nTecnico: ${technician_name || "N/D"}\nData: ${dateFormatted}`,
          html_content: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2 style="color:#667eea;">🔧 Nuovo Rapporto di Intervento</h2>
            <p><strong>${report_number || "N/D"}</strong></p>
            <ul>
              <li>👤 Cliente: ${sanitize(customer_name, 100)}</li>
              <li>🔧 Tecnico: ${sanitize(technician_name, 100)}</li>
              <li>📅 Data: ${dateFormatted}</li>
              ${notes ? `<li>📝 Note: ${sanitize(notes, 200)}</li>` : ""}
            </ul>
            <p>Controlla il gestionale per i dettagli completi.</p>
          </div>`,
          sender_email: "noreply@abbattitorizapper.it",
          sender_name: "ERP Zapper",
          metadata: { type: "nuovo_rapporto_intervento" },
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
    console.error("Error in notify-rapporto-intervento:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
