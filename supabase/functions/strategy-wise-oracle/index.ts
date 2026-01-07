import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();
    console.log(`Strategy Wise Oracle - Action: ${action}`);

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // NEW: Analyze timeline for objective
    if (action === "analyze_timeline") {
      const { title, description, target_date } = data;
      
      const targetDateObj = new Date(target_date);
      const now = new Date();
      const monthsDiff = Math.round((targetDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));

      const systemPrompt = `Sei WISE, un esperto di OKR e pianificazione strategica.
Analizza se la timeline proposta per questo obiettivo è appropriata.

Considera:
1. La complessità dell'obiettivo
2. Il tempo tipico necessario per obiettivi simili
3. I rischi di una timeline troppo aggressiva o troppo lenta

Rispondi SOLO in JSON:
{
  "analysis": {
    "is_appropriate": true/false,
    "suggested_duration": "3 mesi" o altra durata suggerita,
    "reasoning": "Spiegazione dettagliata",
    "risk_level": "low" | "medium" | "high"
  }
}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { 
              role: "user", 
              content: `Obiettivo: ${title}
Descrizione: ${description || "Non specificata"}
Timeline proposta: ${monthsDiff} mesi (data target: ${target_date})

Questa timeline è appropriata?`
            }
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`AI Gateway error: ${response.status}`);
      }

      const aiData = await response.json();
      const content = aiData.choices?.[0]?.message?.content;
      
      let analysis = null;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          analysis = parsed.analysis || parsed;
        }
      } catch (e) {
        console.error("Parse error:", e);
      }

      return new Response(JSON.stringify({ analysis }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // NEW: Suggest Key Results
    if (action === "suggest_key_results") {
      const { title, description, target_date, timeline_analysis } = data;

      const systemPrompt = `Sei WISE, un esperto di OKR.
Genera 3-4 Key Results SMART per questo obiettivo.

Ogni KR deve essere:
- Specifico e misurabile
- Con un target numerico concreto
- Raggiungibile ma sfidante
- Con una deadline realistica

Rispondi SOLO in JSON:
{
  "suggestions": [
    {
      "title": "Descrizione del KR con numero target",
      "target_value": 100,
      "unit": "unità di misura",
      "deadline": "YYYY-MM-DD",
      "rationale": "Perché questo KR è importante"
    }
  ]
}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { 
              role: "user", 
              content: `Obiettivo: ${title}
Descrizione: ${description || "Non specificata"}
Data target: ${target_date}
${timeline_analysis ? `Analisi timeline: ${JSON.stringify(timeline_analysis)}` : ""}

Genera Key Results SMART per questo obiettivo.`
            }
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`AI Gateway error: ${response.status}`);
      }

      const aiData = await response.json();
      const content = aiData.choices?.[0]?.message?.content;
      
      let suggestions = [];
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          suggestions = parsed.suggestions || [];
        }
      } catch (e) {
        console.error("Parse error:", e);
      }

      return new Response(JSON.stringify({ suggestions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // NEW: Check OKR quality
    if (action === "check_okr") {
      const { objective, key_results } = data;

      const systemPrompt = `Sei WISE, un esperto di OKR Checker.
Analizza la qualità di questo OKR e fornisci un feedback dettagliato.

Valuta:
1. Se l'obiettivo è chiaro e ispirante
2. Se i KR sono misurabili e SMART
3. Se il numero di KR è appropriato (ideale: 2-5)
4. Se i KR sono coerenti con l'obiettivo
5. Se le deadline sono realistiche

Rispondi SOLO in JSON:
{
  "check": {
    "overall_score": 0-100,
    "issues": ["problema 1", "problema 2"],
    "strengths": ["punto forte 1", "punto forte 2"],
    "kr_count_assessment": {
      "status": "too_few" | "optimal" | "too_many",
      "message": "Spiegazione"
    },
    "recommendations": ["raccomandazione 1", "raccomandazione 2"]
  }
}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { 
              role: "user", 
              content: `OBIETTIVO:
Titolo: ${objective.title}
Descrizione: ${objective.description || "Non specificata"}
Data target: ${objective.target_date}

KEY RESULTS (${key_results.length}):
${key_results.map((kr: any, i: number) => `
${i + 1}. ${kr.title}
   Target: ${kr.target_value} ${kr.unit}
   Deadline: ${kr.deadline}
`).join("")}

Analizza questo OKR e fornisci un feedback completo.`
            }
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`AI Gateway error: ${response.status}`);
      }

      const aiData = await response.json();
      const content = aiData.choices?.[0]?.message?.content;
      
      let check = null;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          check = parsed.check || parsed;
        }
      } catch (e) {
        console.error("Parse error:", e);
      }

      return new Response(JSON.stringify({ check }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "oracle_analyze") {
      // Fetch ERP data for analysis
      const [leadsResult, ordersResult, offersResult, workOrdersResult, customersResult] = await Promise.all([
        supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("offers").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("work_orders").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("customers").select("*").limit(100),
      ]);

      const erpData = {
        leads: leadsResult.data || [],
        orders: ordersResult.data || [],
        offers: offersResult.data || [],
        workOrders: workOrdersResult.data || [],
        customers: customersResult.data || [],
      };

      console.log(`ERP Data loaded: ${erpData.leads.length} leads, ${erpData.orders.length} orders, ${erpData.offers.length} offers`);

      const systemPrompt = `Sei ORACLE, la funzione esplorativa del sistema Strategy Wise Oracle.
Analizza i dati ERP forniti per far emergere pattern, colli di bottiglia, opportunità e rischi strategici.

Il tuo compito è:
1. Identificare opportunità nascoste nei dati
2. Rilevare colli di bottiglia operativi
3. Evidenziare rischi potenziali
4. Scoprire blind spot (zone d'ombra)

Per ogni insight fornisci:
- Tipo: opportunity | risk | bottleneck | blindspot
- Titolo breve e incisivo
- Descrizione dettagliata con dati a supporto
- Fonte dei dati utilizzata
- Livello di confidenza (0-100)
- Azione suggerita

Rispondi SOLO in formato JSON con la struttura:
{
  "insights": [
    {
      "type": "opportunity|risk|bottleneck|blindspot",
      "title": "...",
      "description": "...",
      "data_source": "...",
      "confidence": 85,
      "suggested_action": "..."
    }
  ]
}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { 
              role: "user", 
              content: `Analizza questi dati ERP e fornisci insights strategici:

LEAD (ultimi 100):
- Totale: ${erpData.leads.length}
- Per stato: ${JSON.stringify(groupByField(erpData.leads, 'status'))}
- Per fonte: ${JSON.stringify(groupByField(erpData.leads, 'source'))}
- Per paese: ${JSON.stringify(groupByField(erpData.leads, 'country'))}

ORDINI (ultimi 100):
- Totale: ${erpData.orders.length}
- Per stato: ${JSON.stringify(groupByField(erpData.orders, 'status'))}
- Valore totale: ${erpData.orders.reduce((sum, o) => sum + (o.total_amount || 0), 0)}€

OFFERTE (ultime 100):
- Totale: ${erpData.offers.length}
- Per stato: ${JSON.stringify(groupByField(erpData.offers, 'status'))}
- Tasso conversione stimato: ${calculateConversionRate(erpData.offers)}%

WORK ORDERS (ultimi 50):
- Totale: ${erpData.workOrders.length}
- Per stato: ${JSON.stringify(groupByField(erpData.workOrders, 'status'))}

CLIENTI:
- Totale attivi: ${erpData.customers.length}
- Per paese: ${JSON.stringify(groupByField(erpData.customers, 'country'))}

Identifica almeno 3-5 insights significativi.`
            }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI Gateway error:", response.status, errorText);
        throw new Error(`AI Gateway error: ${response.status}`);
      }

      const aiData = await response.json();
      const content = aiData.choices?.[0]?.message?.content;
      
      console.log("AI Response received:", content?.substring(0, 200));

      let insights = [];
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          insights = parsed.insights || [];
        }
      } catch (parseError) {
        console.error("Error parsing AI response:", parseError);
        insights = [];
      }

      return new Response(JSON.stringify({ insights }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "wise_analyze") {
      const { objective, keyResults } = data;

      const systemPrompt = `Sei WISE, la funzione valutativa del sistema Strategy Wise Oracle.
Il tuo compito è analizzare un obiettivo strategico e i suoi Key Results per verificarne:
1. Fattibilità e realismo
2. Coerenza con le risorse disponibili
3. Qualità della formulazione OKR
4. Sostenibilità del carico operativo

Fornisci una valutazione strutturata con:
- Score fattibilità (0-100)
- Score coerenza (0-100)  
- Score carico CC (0-100, dove 100 = carico sostenibile)
- Suggerimenti di miglioramento
- Rischi identificati
- KR da riformulare

Rispondi SOLO in formato JSON:
{
  "analysis": {
    "feasibility_score": 75,
    "coherence_score": 85,
    "workload_score": 60,
    "overall_assessment": "...",
    "suggestions": ["...", "..."],
    "risks": ["...", "..."],
    "kr_improvements": [
      {"kr_index": 0, "issue": "...", "suggestion": "..."}
    ]
  }
}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { 
              role: "user", 
              content: `Analizza questo obiettivo strategico:

OBJECTIVE:
Titolo: ${objective.title}
Descrizione: ${objective.description}
Impatto previsto: ${objective.impact}
Sforzo stimato: ${objective.effort}
Data target: ${objective.target_date}

KEY RESULTS:
${keyResults.map((kr: any, i: number) => `
${i + 1}. ${kr.title}
   Target: ${kr.target_value} ${kr.unit}
   Attuale: ${kr.current_value} ${kr.unit}
   Deadline: ${kr.deadline}
   Stato: ${kr.status}
`).join('\n')}

Fornisci un'analisi WISE completa.`
            }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI Gateway error:", response.status, errorText);
        throw new Error(`AI Gateway error: ${response.status}`);
      }

      const aiData = await response.json();
      const content = aiData.choices?.[0]?.message?.content;

      let analysis = null;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          analysis = parsed.analysis || parsed;
        }
      } catch (parseError) {
        console.error("Error parsing AI response:", parseError);
      }

      return new Response(JSON.stringify({ analysis }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "convert_insight_to_objective") {
      const { insight } = data;

      const systemPrompt = `Sei WISE. Converti un insight ORACLE in un obiettivo strategico strutturato con Key Results.

Crea:
1. Un Objective chiaro e misurabile
2. 2-4 Key Results SMART
3. Una timeline realistica

Rispondi SOLO in formato JSON:
{
  "objective": {
    "title": "...",
    "description": "...",
    "impact": "low|medium|high",
    "effort": "low|medium|high",
    "target_date": "YYYY-MM-DD"
  },
  "key_results": [
    {
      "title": "...",
      "target_value": 100,
      "unit": "...",
      "deadline": "YYYY-MM-DD"
    }
  ]
}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { 
              role: "user", 
              content: `Converti questo insight in un obiettivo OKR:

Tipo: ${insight.type}
Titolo: ${insight.title}
Descrizione: ${insight.description}
Azione suggerita: ${insight.suggested_action}
Confidenza: ${insight.confidence}%`
            }
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI Gateway error:", response.status, errorText);
        throw new Error(`AI Gateway error: ${response.status}`);
      }

      const aiData = await response.json();
      const content = aiData.choices?.[0]?.message?.content;

      let result = null;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.error("Error parsing AI response:", parseError);
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error("Strategy Wise Oracle error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function groupByField(items: any[], field: string): Record<string, number> {
  return items.reduce((acc, item) => {
    const key = item[field] || "N/A";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function calculateConversionRate(offers: any[]): number {
  if (offers.length === 0) return 0;
  const converted = offers.filter(o => o.status === "accepted" || o.status === "converted").length;
  return Math.round((converted / offers.length) * 100);
}
