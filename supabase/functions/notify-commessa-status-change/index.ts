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
    const { commessa_id, commessa_title, commessa_type, new_status, customer_name, deadline } = await req.json();

    console.log("Notifying about commessa status change:", { commessa_id, commessa_title, new_status });

    // Get notification rules for cambio_stato_commessa event, channel whatsapp
    const { data: rules, error: rulesError } = await supabase
      .from("zapp_notification_rules")
      .select("*")
      .eq("event_type", "cambio_stato_commessa")
      .eq("channel", "whatsapp")
      .eq("is_active", true);

    if (rulesError) {
      console.error("Error fetching notification rules:", rulesError);
      throw rulesError;
    }

    if (!rules || rules.length === 0) {
      console.log("No active WhatsApp notification rules for cambio_stato_commessa");
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

    // Map status to Italian labels
    const statusLabels: Record<string, string> = {
      da_fare: "Da Fare",
      in_lavorazione: "In Lavorazione",
      in_test: "In Test",
      standby: "Standby",
      bloccato: "Bloccato",
      pronto: "Pronto",
      da_programmare: "Da Programmare",
      programmato: "Programmato",
      in_corso: "In Corso",
      completato: "Completato",
      annullato: "Annullato",
      in_preparazione: "In Preparazione",
      spedito: "Spedito",
      consegnato: "Consegnato",
    };

    const typeLabels: Record<string, string> = {
      fornitura: "Fornitura",
      intervento: "Intervento",
      ricambi: "Ricambi",
    };

    const statusLabel = statusLabels[new_status] || new_status || "N/D";
    const typeLabel = typeLabels[commessa_type] || commessa_type || "N/D";
    const deadlineFormatted = deadline
      ? new Date(deadline).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "Non specificata";

    const results: { name: string; success: boolean; error?: string }[] = [];

    for (const rule of rules) {
      const phone = rule.recipient_phone;
      if (!phone) {
        console.warn(`No phone for recipient ${rule.recipient_name}`);
        results.push({ name: rule.recipient_name, success: false, error: "Nessun numero di telefono" });
        continue;
      }

      try {
        // Template params: {{1}} = name, {{2}} = commessa title, {{3}} = new status, {{4}} = type, {{5}} = customer, {{6}} = deadline
        const templateParams = [
          rule.recipient_name,
          commessa_title || "Commessa",
          statusLabel,
          typeLabel,
          customer_name || "N/D",
          deadlineFormatted,
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
              template_name: "cambio_stato_commessa",
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

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in notify-commessa-status-change:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
