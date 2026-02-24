import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { fileUrl, fileName, query } = await req.json();
    if (!fileUrl || !query) {
      return new Response(JSON.stringify({ error: "fileUrl and query are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    console.log(`Searching competitor pricelist: ${fileName}, query: ${query}`);

    const systemPrompt = `Sei un assistente esperto nell'analisi di listini prezzi di competitor nel settore dei forni professionali, abbattitori di temperatura e attrezzature per la ristorazione.

Ti viene fornito un documento (listino prezzi) e una domanda dell'utente. Rispondi in modo preciso e dettagliato basandoti ESCLUSIVAMENTE sul contenuto del documento.

Regole:
- Rispondi sempre in italiano
- Se trovi prezzi, riportali esattamente come nel documento
- Se trovi specifiche tecniche, elencale in modo chiaro
- Se la risposta non è nel documento, dillo chiaramente
- Formatta la risposta in modo leggibile usando elenchi puntati quando appropriato
- Sii conciso ma completo`;

    // Use openai/gpt-5 which handles PDF URLs natively without downloading
    const userContent = [
      { type: "text", text: query },
      { type: "image_url", image_url: { url: fileUrl } },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
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

    const aiData = await response.json();
    const answer = aiData.choices?.[0]?.message?.content || "Nessuna risposta dall'AI.";

    console.log(`AI answer length: ${answer.length}`);
    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-competitor-pricelist error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
