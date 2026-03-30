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

    // Find assegno movements expiring in the next 3 days that haven't been collected yet
    const today = new Date();
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const todayStr = today.toISOString().split("T")[0];
    const futureStr = threeDaysFromNow.toISOString().split("T")[0];

    // Get all assegno movements with check_due_date <= 3 days from now
    const { data: movimenti, error: movError } = await supabase
      .from("scadenza_movimenti")
      .select("id, scadenza_id, importo, check_due_date, check_number, data_movimento")
      .eq("metodo_pagamento", "assegno")
      .not("check_due_date", "is", null)
      .lte("check_due_date", futureStr)
      .gte("check_due_date", todayStr);

    if (movError) throw movError;
    if (!movimenti || movimenti.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Nessun assegno in scadenza", results: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the linked scadenze to check they're not already collected
    const scadenzaIds = [...new Set(movimenti.map(m => m.scadenza_id))];
    const { data: scadenze } = await supabase
      .from("scadenze")
      .select("id, stato, tipo, soggetto_nome")
      .in("id", scadenzaIds);

    const scadenzeMap = new Map((scadenze || []).map(s => [s.id, s]));

    // Filter only uncollected ones
    const pendingAssegni = movimenti.filter(m => {
      const sc = scadenzeMap.get(m.scadenza_id);
      return sc && sc.stato !== "chiusa" && sc.stato !== "saldata";
    });

    if (pendingAssegni.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "Tutti gli assegni sono già incassati", results: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get notification rules for this event type
    const { data: rules } = await supabase
      .from("zapp_notification_rules")
      .select("*")
      .eq("event_type", "assegno_in_scadenza")
      .eq("is_active", true);

    if (!rules || rules.length === 0) {
      // Fallback: send to admin emails
      // Build email content
      const assegniHtml = pendingAssegni.map(a => {
        const sc = scadenzeMap.get(a.scadenza_id);
        const dueDate = a.check_due_date ? new Date(a.check_due_date).toLocaleDateString("it-IT") : "N/D";
        const daysLeft = a.check_due_date ? Math.ceil((new Date(a.check_due_date).getTime() - today.getTime()) / 86400000) : 0;
        const daysLabel = daysLeft === 0 ? "OGGI" : daysLeft === 1 ? "domani" : `tra ${daysLeft} giorni`;
        return `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${fmtEuro(Number(a.importo))}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${sc?.soggetto_nome || "N/D"}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${a.check_number || "-"}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${dueDate}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;color:${daysLeft <= 0 ? '#dc2626' : '#d97706'}">${daysLabel}</td>
        </tr>`;
      }).join("");

      const htmlContent = `<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px;">
        <h2 style="color:#4f46e5;">🏦 Assegni in Scadenza</h2>
        <p>I seguenti assegni sono in scadenza nei prossimi giorni:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <thead><tr style="background:#f8fafc;">
            <th style="padding:8px;text-align:left;border-bottom:2px solid #e2e8f0;">Importo</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #e2e8f0;">Soggetto</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #e2e8f0;">N. Assegno</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #e2e8f0;">Scadenza</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #e2e8f0;">Giorni</th>
          </tr></thead>
          <tbody>${assegniHtml}</tbody>
        </table>
        <p style="color:#64748b;font-size:13px;">Ricordati di presentare gli assegni in banca per l'incasso prima della scadenza.</p>
      </div>`;

      // Send to default admin emails
      const defaultEmails = ["info@abbattitorizapper.it", "amministrazione@abbattitorizapper.it"];
      const results: { email: string; success: boolean; error?: string }[] = [];

      for (const email of defaultEmails) {
        try {
          await supabase.from("email_queue").insert({
            recipient_email: email,
            recipient_name: "Amministrazione",
            subject: `🏦 ${pendingAssegni.length} Assegn${pendingAssegni.length === 1 ? 'o' : 'i'} in Scadenza`,
            message: `Ci sono ${pendingAssegni.length} assegni in scadenza nei prossimi 3 giorni.`,
            html_content: htmlContent,
            sender_email: "noreply@abbattitorizapper.it",
            sender_name: "ERP Zapper",
            metadata: { type: "assegno_in_scadenza" },
          });
          results.push({ email, success: true });
        } catch (err) {
          results.push({ email, success: false, error: err.message });
        }
      }

      return new Response(JSON.stringify({ success: true, count: pendingAssegni.length, results }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use notification rules
    const results: { name: string; success: boolean; error?: string }[] = [];
    for (const rule of rules.filter(r => r.channel === "email")) {
      if (!rule.recipient_email) { results.push({ name: rule.recipient_name, success: false, error: "Nessuna email" }); continue; }
      try {
        const assegniHtml = pendingAssegni.map(a => {
          const sc = scadenzeMap.get(a.scadenza_id);
          const dueDate = a.check_due_date ? new Date(a.check_due_date).toLocaleDateString("it-IT") : "N/D";
          const daysLeft = a.check_due_date ? Math.ceil((new Date(a.check_due_date).getTime() - today.getTime()) / 86400000) : 0;
          const daysLabel = daysLeft === 0 ? "OGGI" : daysLeft === 1 ? "domani" : `tra ${daysLeft} giorni`;
          return `<tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">${fmtEuro(Number(a.importo))}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${sc?.soggetto_nome || "N/D"}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${a.check_number || "-"}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;">${dueDate}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;color:${daysLeft <= 0 ? '#dc2626' : '#d97706'}">${daysLabel}</td>
          </tr>`;
        }).join("");

        await supabase.from("email_queue").insert({
          recipient_email: rule.recipient_email,
          recipient_name: rule.recipient_name,
          subject: `🏦 ${pendingAssegni.length} Assegn${pendingAssegni.length === 1 ? 'o' : 'i'} in Scadenza`,
          message: `Ci sono ${pendingAssegni.length} assegni in scadenza nei prossimi 3 giorni.`,
          html_content: `<div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;padding:20px;">
            <h2 style="color:#4f46e5;">🏦 Assegni in Scadenza</h2>
            <p>Ciao ${rule.recipient_name}, i seguenti assegni sono in scadenza:</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <thead><tr style="background:#f8fafc;">
                <th style="padding:8px;text-align:left;">Importo</th>
                <th style="padding:8px;text-align:left;">Soggetto</th>
                <th style="padding:8px;text-align:left;">N. Assegno</th>
                <th style="padding:8px;text-align:left;">Scadenza</th>
                <th style="padding:8px;text-align:left;">Giorni</th>
              </tr></thead>
              <tbody>${assegniHtml}</tbody>
            </table>
            <p style="color:#64748b;font-size:13px;">Presenta gli assegni in banca prima della scadenza.</p>
          </div>`,
          sender_email: "noreply@abbattitorizapper.it",
          sender_name: "ERP Zapper",
          metadata: { type: "assegno_in_scadenza" },
        });
        results.push({ name: rule.recipient_name, success: true });
      } catch (err) {
        results.push({ name: rule.recipient_name, success: false, error: err.message });
      }
    }

    return new Response(JSON.stringify({ success: true, count: pendingAssegni.length, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in notify-assegno-scadenza:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function fmtEuro(n: number): string {
  return `€ ${n.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`;
}
