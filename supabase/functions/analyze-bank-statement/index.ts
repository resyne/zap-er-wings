import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const direction = formData.get("direction") as string || "outflow";
    const userId = formData.get("userId") as string || null;

    if (!file) {
      return new Response(JSON.stringify({ error: "File richiesto" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check file size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "File troppo grande (max 20MB)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(fileBuffer);
    let binary = '';
    for (let i = 0; i < fileBytes.length; i++) {
      binary += String.fromCharCode(fileBytes[i]);
    }
    const fileBase64 = btoa(binary);

    const isImage = file.type.startsWith("image/");
    const mimeType = file.type || "application/pdf";
    const dataUrl = `data:${mimeType};base64,${fileBase64}`;

    const systemPrompt = `Sei un esperto contabile italiano specializzato nell'analisi di estratti conto bancari.

Analizza il documento dell'estratto conto bancario fornito ed estrai TUTTI i movimenti presenti.

Per ogni movimento estrai:
- data_movimento: data del movimento in formato YYYY-MM-DD
- data_valuta: data valuta in formato YYYY-MM-DD (se presente, altrimenti uguale a data_movimento)
- descrizione: descrizione/causale del movimento
- importo: importo in valore assoluto (sempre positivo)
- tipo: "entrata" o "uscita" basato sul segno del movimento (DARE=uscita, AVERE=entrata, o dedotto dal contesto)
- riferimento: eventuale riferimento CRO/TRN/numero operazione
- conto_bancario: IBAN o numero conto se visibile nel documento

REGOLE IMPORTANTI:
- Estrai OGNI SINGOLO movimento presente nel documento, non saltarne nessuno
- Gli importi devono essere SEMPRE positivi (il tipo indica se entrata o uscita)
- Se il formato ha colonne DARE/AVERE separate, DARE = uscita, AVERE = entrata
- Se c'è una sola colonna importo, i negativi sono uscite, i positivi entrate
- Le date devono essere in formato YYYY-MM-DD
- Non inventare dati, estrai solo quello che vedi nel documento`;

    const userContent: any[] = [
      { type: "text", text: "Analizza questo estratto conto bancario ed estrai tutti i movimenti." },
    ];

    if (isImage) {
      userContent.push({ type: "image_url", image_url: { url: dataUrl } });
    } else {
      userContent.push({ type: "image_url", image_url: { url: dataUrl } });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_bank_movements",
            description: "Extract all bank movements from the statement",
            parameters: {
              type: "object",
              properties: {
                bank_name: { type: "string", description: "Nome della banca" },
                account_iban: { type: "string", description: "IBAN del conto" },
                period: { type: "string", description: "Periodo dell'estratto conto" },
                movements: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      data_movimento: { type: "string", description: "Data movimento YYYY-MM-DD" },
                      data_valuta: { type: "string", description: "Data valuta YYYY-MM-DD" },
                      descrizione: { type: "string", description: "Descrizione/causale" },
                      importo: { type: "number", description: "Importo in valore assoluto" },
                      tipo: { type: "string", enum: ["entrata", "uscita"], description: "Tipo movimento" },
                      riferimento: { type: "string", description: "Riferimento CRO/TRN" },
                    },
                    required: ["data_movimento", "descrizione", "importo", "tipo"],
                    additionalProperties: false,
                  },
                },
                total_movements: { type: "number", description: "Numero totale movimenti estratti" },
              },
              required: ["movements", "total_movements"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_bank_movements" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Troppi tentativi. Riprova tra qualche secondo." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("Nessun dato strutturato estratto dall'AI");
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    // Filter movements by direction
    const filteredMovements = extracted.movements.map((m: any) => {
      const isOutflow = direction === "outflow";
      const movDirection = m.tipo === "uscita" ? "outflow" : "inflow";
      return {
        ...m,
        direction: movDirection,
        relevant: movDirection === direction,
      };
    });

    return new Response(JSON.stringify({
      success: true,
      bank_name: extracted.bank_name || null,
      account_iban: extracted.account_iban || null,
      period: extracted.period || null,
      total_movements: extracted.total_movements,
      movements: filteredMovements,
      direction,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("analyze-bank-statement error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
