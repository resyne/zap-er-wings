import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { invoice, chartOfAccounts, costCenters, profitCenters } = await req.json();

    if (!invoice) {
      return new Response(JSON.stringify({ error: "Invoice data required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch historical data for this subject to learn patterns
    let historicalContext = "";
    if (invoice.subject_name) {
      const { data: pastInvoices } = await supabase
        .from("invoice_registry")
        .select("invoice_type, imponibile, iva_rate, vat_regime, cost_center_id, profit_center_id, cost_account_id, revenue_account_id, financial_status, status")
        .ilike("subject_name", `%${invoice.subject_name}%`)
        .eq("status", "contabilizzato")
        .order("created_at", { ascending: false })
        .limit(10);

      if (pastInvoices && pastInvoices.length > 0) {
        // Map IDs to names
        const ccIds = [...new Set(pastInvoices.map(i => i.cost_center_id).filter(Boolean))];
        const pcIds = [...new Set(pastInvoices.map(i => i.profit_center_id).filter(Boolean))];
        const accIds = [...new Set([
          ...pastInvoices.map(i => i.cost_account_id).filter(Boolean),
          ...pastInvoices.map(i => i.revenue_account_id).filter(Boolean)
        ])];

        const ccMap: Record<string, string> = {};
        const pcMap: Record<string, string> = {};
        const accMap: Record<string, string> = {};

        if (ccIds.length > 0) {
          const { data } = await supabase.from("cost_centers").select("id, name, code").in("id", ccIds);
          data?.forEach(c => ccMap[c.id] = `${c.code} - ${c.name}`);
        }
        if (pcIds.length > 0) {
          const { data } = await supabase.from("profit_centers").select("id, name, code").in("id", pcIds);
          data?.forEach(c => pcMap[c.id] = `${c.code} - ${c.name}`);
        }
        if (accIds.length > 0) {
          const { data } = await supabase.from("chart_of_accounts").select("id, name, code").in("id", accIds);
          data?.forEach(a => accMap[a.id] = `${a.code} - ${a.name}`);
        }

        historicalContext = `\n\nSTORICO FATTURE PRECEDENTI PER "${invoice.subject_name}" (ultime ${pastInvoices.length}):\n`;
        pastInvoices.forEach((inv, i) => {
          historicalContext += `${i + 1}. Tipo: ${inv.invoice_type}, Imponibile: €${inv.imponibile}, IVA: ${inv.iva_rate}%, Regime: ${inv.vat_regime}`;
          if (inv.cost_center_id && ccMap[inv.cost_center_id]) historicalContext += `, CdC: ${ccMap[inv.cost_center_id]}`;
          if (inv.profit_center_id && pcMap[inv.profit_center_id]) historicalContext += `, CdR: ${pcMap[inv.profit_center_id]}`;
          if (inv.cost_account_id && accMap[inv.cost_account_id]) historicalContext += `, Conto: ${accMap[inv.cost_account_id]}`;
          if (inv.revenue_account_id && accMap[inv.revenue_account_id]) historicalContext += `, Conto: ${accMap[inv.revenue_account_id]}`;
          historicalContext += "\n";
        });
        historicalContext += "\nUSA LO STORICO per suggerire classificazioni coerenti con le registrazioni precedenti dello stesso soggetto.";
      }
    }

    const accountsContext = chartOfAccounts?.map((a: any) =>
      `- ${a.code} - ${a.name} (${a.account_type}, id: ${a.id})`
    ).join("\n") || "Nessun conto";

    const costCentersContext = costCenters?.map((c: any) =>
      `- ${c.code} - ${c.name} (id: ${c.id})`
    ).join("\n") || "Nessun centro di costo";

    const profitCentersContext = profitCenters?.map((c: any) =>
      `- ${c.code} - ${c.name} (id: ${c.id})`
    ).join("\n") || "Nessun centro di ricavo";

    const systemPrompt = `Sei un commercialista italiano esperto. Analizza la fattura e suggerisci la migliore classificazione contabile.

AZIENDA: Climatel di Elefante Pasquale (settore: climatizzazione, impianti termici, canne fumarie)

FATTURA DA ANALIZZARE:
- Tipo: ${invoice.invoice_type} (${invoice.invoice_type === 'vendita' ? 'Fattura emessa a cliente' : invoice.invoice_type === 'acquisto' ? 'Fattura ricevuta da fornitore' : 'Nota di credito'})
- Soggetto: ${invoice.subject_name || 'Non specificato'} (${invoice.subject_type || 'N/D'})
- Imponibile: €${invoice.imponibile}
- Aliquota IVA: ${invoice.iva_rate}%
- Regime IVA attuale: ${invoice.vat_regime || 'non specificato'}
- Stato finanziario: ${invoice.financial_status || 'non specificato'}
- Data: ${invoice.invoice_date}
- Note: ${invoice.notes || 'nessuna'}
${historicalContext}

PIANO DEI CONTI:
${accountsContext}

CENTRI DI COSTO:
${costCentersContext}

CENTRI DI RICAVO:
${profitCentersContext}

REGOLE:
1. Per ACQUISTI: suggerisci conto di COSTO e centro di COSTO
2. Per VENDITE: suggerisci conto di RICAVO e centro di RICAVO
3. Regime IVA: ordinario 22% per Italia, reverse_charge per subappalti edili, intra-UE per forniture EU, extra-UE se applicabile
4. Basa le scelte sul tipo di attività del soggetto e lo storico
5. Spiega brevemente il ragionamento`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Analizza questa fattura e suggerisci la classificazione contabile ottimale." },
        ],
        tools: [{
          type: "function",
          function: {
            name: "suggest_accounting",
            description: "Suggerisci la classificazione contabile per la fattura",
            parameters: {
              type: "object",
              properties: {
                cost_account_id: { type: "string", description: "ID del conto di costo suggerito (per acquisti)" },
                revenue_account_id: { type: "string", description: "ID del conto di ricavo suggerito (per vendite)" },
                cost_center_id: { type: "string", description: "ID del centro di costo suggerito" },
                profit_center_id: { type: "string", description: "ID del centro di ricavo suggerito" },
                vat_regime: {
                  type: "string",
                  enum: ["domestica_imponibile", "ue_non_imponibile", "extra_ue", "reverse_charge"],
                  description: "Regime IVA suggerito"
                },
                iva_rate: { type: "number", description: "Aliquota IVA suggerita (22, 10, 4, 0)" },
                financial_status: {
                  type: "string",
                  enum: ["da_incassare", "da_pagare", "incassata", "pagata"],
                  description: "Stato finanziario suggerito"
                },
                reasoning: { type: "string", description: "Spiegazione del ragionamento (in italiano, 2-3 frasi)" },
                confidence: {
                  type: "string",
                  enum: ["high", "medium", "low"],
                  description: "Livello di confidenza"
                },
                warnings: {
                  type: "array",
                  items: { type: "string" },
                  description: "Eventuali avvisi o attenzioni (es. regime IVA diverso dallo storico, soggetto nuovo, ecc.)"
                }
              },
              required: ["reasoning", "confidence"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "suggest_accounting" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Troppe richieste, riprova tra poco." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error("No valid AI response");
    }

    const suggestion = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, suggestion }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-accounting-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
