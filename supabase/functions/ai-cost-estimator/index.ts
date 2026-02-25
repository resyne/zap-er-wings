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
    const { messages, context } = await req.json();
    console.log("AI Cost Estimator - received request");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch reference data for cost estimation
    const [techniciansResult, materialsResult, settingsResult] = await Promise.all([
      supabase.from("technicians").select("id, first_name, last_name, hourly_rate, specializations").eq("active", true),
      supabase.from("materials").select("id, code, name, cost, unit, supplier_id, suppliers!materials_supplier_id_fkey(name)").eq("active", true).order("name"),
      supabase.from("service_report_settings").select("setting_key, setting_value"),
    ]);

    const technicians = techniciansResult.data || [];
    const materials = materialsResult.data || [];
    const settings = settingsResult.data || [];

    // Build settings map
    const settingsMap: Record<string, string> = {};
    settings.forEach((s: any) => { settingsMap[s.setting_key] = s.setting_value; });

    // Build materials catalog summary (group by supplier)
    const materialsBySupplier: Record<string, any[]> = {};
    materials.forEach((m: any) => {
      const supplierName = m.suppliers?.name || "Senza fornitore";
      if (!materialsBySupplier[supplierName]) materialsBySupplier[supplierName] = [];
      materialsBySupplier[supplierName].push({
        code: m.code,
        name: m.name,
        cost: m.cost,
        unit: m.unit,
      });
    });

    const materialsCatalog = Object.entries(materialsBySupplier)
      .map(([supplier, items]) => `\n## Fornitore: ${supplier}\n${items.map(i => `- ${i.code} | ${i.name} | €${i.cost}/${i.unit}`).join("\n")}`)
      .join("\n");

    const techniciansList = technicians.map((t: any) =>
      `- ${t.first_name} ${t.last_name}: €${t.hourly_rate}/ora (specializzazioni: ${(t.specializations || []).join(", ") || "generiche"})`
    ).join("\n");

    const systemPrompt = `Sei un assistente AI specializzato nell'ANALISI DEI COSTI per l'azienda Zapper (produttore di forni professionali per pizzeria).

## REGOLA FONDAMENTALE
Tu devi calcolare ESCLUSIVAMENTE i COSTI VIVI che l'azienda sostiene per eseguire un lavoro.
NON devi MAI calcolare prezzi di vendita, margini, ricarichi o prezzi al cliente.
Il tuo output è un'analisi costi pura: quanto costa ALL'AZIENDA fare quel lavoro.
L'utente deciderà autonomamente il prezzo di vendita basandosi sulla tua analisi.

## CONTESTO AZIENDALE
- Azienda: Zapper - produttore di forni professionali per pizzeria
- Attività tipiche: installazioni, manutenzioni, fornitura e posa canna fumaria, assistenza tecnica

## IMPOSTAZIONI AZIENDALI
${Object.entries(settingsMap).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

## COSTO ORARIO TECNICI (costo aziendale)
${techniciansList}

## CATALOGO MATERIALI CON COSTI DI ACQUISTO (prezzi fornitore)
${materialsCatalog.substring(0, 8000)}

## FUNZIONE SPECIFICA: FORNITURA E POSA CANNA FUMARIA
Quando l'utente chiede un'analisi costi per canna fumaria, raccogli queste informazioni:
1. Altezza totale della canna fumaria (in metri)
2. Diametro (tipicamente 200mm, 250mm, 300mm, 350mm)
3. Tipo di installazione (interna/esterna, tetto piano/spiovente)
4. Numero di curve necessarie
5. Presenza di attraversamenti (solai, tetti)
6. Necessità di base/piastra di raccolta condensa
7. Cappello terminale (tipo)
8. Numero di tecnici necessari
9. Tempo stimato di installazione

Per il calcolo dei COSTI considera:
- Costo di acquisto materiale canna fumaria al metro (dal listino fornitori)
- Costo di acquisto raccordi, curve, fascette (dal listino fornitori)
- Costo manodopera (tariffa oraria tecnico x ore x numero tecnici)
- Costi accessori (ponteggio, cestello, noleggio attrezzature se necessario)
- NON aggiungere MAI margini o ricarichi

## FORMATO RISPOSTA
Quando hai raccolto abbastanza informazioni, fornisci il risultato in questo formato strutturato:

\`\`\`json
{
  "type": "estimate",
  "title": "Analisi Costi - Titolo del lavoro",
  "items": [
    {
      "category": "Materiali" | "Manodopera" | "Accessori" | "Noleggi",
      "description": "Descrizione voce di costo",
      "quantity": 1,
      "unit": "mt" | "pz" | "ore" | "gg",
      "unit_price": 100.00,
      "total": 100.00
    }
  ],
  "subtotal": 0,
  "margin_percent": 0,
  "margin_amount": 0,
  "total_net": 0,
  "vat_percent": 0,
  "vat_amount": 0,
  "total_gross": 0,
  "notes": ["Nota 1"],
  "assumptions": ["Ipotesi 1"]
}
\`\`\`

IMPORTANTE nel JSON:
- margin_percent, margin_amount, vat_percent, vat_amount DEVONO essere sempre 0
- total_net e total_gross DEVONO essere uguali al subtotal (è il costo puro)
- Le voci "unit_price" sono i COSTI DI ACQUISTO o COSTI ORARI, mai prezzi di vendita

Se non hai ancora tutte le informazioni, fai domande conversazionali per raccoglierle.
Quando fornisci l'analisi costi strutturata, includi sia il JSON che una spiegazione discorsiva.
Alla fine, ricorda all'utente che questo è il COSTO VIVO e che dovrà aggiungere il suo margine per il prezzo di vendita.

Rispondi SEMPRE in italiano.`;

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
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit superato, riprova tra poco." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("AI Cost Estimator error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
