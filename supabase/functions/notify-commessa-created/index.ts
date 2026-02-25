import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Technician IDs to notify
const TECHNICIAN_IDS = [
  "315e7063-f29b-490e-b6af-b7404446f124", // Pasquale
  "10b28d44-46d9-4e11-a0e3-d39069ed128b", // Antonio
  "e8015672-517f-4fd0-8c24-7e8db4dcc583", // Stefano
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { commessa_title, commessa_type, deadline, customer_name } = await req.json();

    console.log("Notifying technicians about new commessa:", { commessa_title, commessa_type, deadline, customer_name });

    // Get technicians with phone numbers
    const { data: technicians, error: techError } = await supabase
      .from("technicians")
      .select("id, first_name, last_name, phone, mobile")
      .in("id", TECHNICIAN_IDS);

    if (techError) {
      console.error("Error fetching technicians:", techError);
      throw techError;
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

    const results: { name: string; success: boolean; error?: string }[] = [];

    // Map commessa type to Italian label
    const typeLabels: Record<string, string> = {
      fornitura: "Fornitura",
      intervento: "Intervento",
      ricambi: "Ricambi",
    };
    const typeLabel = typeLabels[commessa_type] || commessa_type || "N/D";
    const deadlineFormatted = deadline
      ? new Date(deadline).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "Non specificata";

    for (const tech of technicians || []) {
      const phone = tech.mobile || tech.phone;
      if (!phone) {
        console.warn(`No phone for technician ${tech.first_name} ${tech.last_name}`);
        results.push({ name: `${tech.first_name} ${tech.last_name}`, success: false, error: "Nessun numero di telefono" });
        continue;
      }

      const techName = `${tech.first_name} ${tech.last_name}`;

      try {
        // Template params: {{1}} = tech name, {{2}} = commessa title, {{3}} = type, {{4}} = deadline, {{5}} = customer
        const templateParams = [
          techName,
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
          console.log(`WhatsApp sent to ${techName} (${phone})`);
          results.push({ name: techName, success: true });
        } else {
          console.error(`WhatsApp failed for ${techName}:`, waResult.error);
          results.push({ name: techName, success: false, error: waResult.error });
        }
      } catch (err) {
        console.error(`Error sending to ${techName}:`, err);
        results.push({ name: techName, success: false, error: err.message });
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
