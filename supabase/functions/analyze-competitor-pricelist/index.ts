import { serve } from "https://deno.land/std@0.168.0/http/server.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { fileUrl, competitorId, fileName } = await req.json();
    if (!fileUrl) {
      return new Response(JSON.stringify({ error: "fileUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Use Gemini for all file types - it supports PDFs natively via URL
    const model = "google/gemini-2.5-flash";
    
    // Pass URL directly to avoid memory issues with large files
    const imageUrl = fileUrl;

    console.log(`Analyzing competitor pricelist: ${fileName}, model: ${model}`);

    const systemPrompt = `Sei un analista di mercato specializzato nell'estrazione di dati da listini prezzi di competitor nel settore dei forni professionali, abbattitori di temperatura e attrezzature per la ristorazione.

Analizza il documento e estrai TUTTI i prodotti/modelli con i seguenti dati:
- name: nome completo del prodotto
- model: codice modello o SKU
- category: categoria (es: "Forni", "Abbattitori", "Lavatrici", "Accessori", ecc.)
- price: prezzo in formato numerico (senza simboli valuta)
- currency: valuta (EUR, USD, GBP ecc.)
- notes: eventuali note tecniche rilevanti (capacità, dimensioni, potenza)
- specifications: oggetto JSON con specifiche tecniche chiave (dimensioni, peso, potenza, capacità, ecc.)

Estrai il maggior numero possibile di prodotti. Se il prezzo non è disponibile, metti null.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: `Analizza questo listino prezzi competitor ed estrai tutti i prodotti con prezzi e specifiche. File: ${fileName || "listino"}` },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_competitor_products",
              description: "Estrae i prodotti dal listino competitor",
              parameters: {
                type: "object",
                properties: {
                  products: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Nome del prodotto" },
                        model: { type: "string", description: "Codice modello/SKU" },
                        category: { type: "string", description: "Categoria prodotto" },
                        price: { type: "number", description: "Prezzo" },
                        currency: { type: "string", description: "Valuta" },
                        notes: { type: "string", description: "Note tecniche" },
                        specifications: { type: "object", description: "Specifiche tecniche" },
                      },
                      required: ["name"],
                    },
                  },
                },
                required: ["products"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_competitor_products" } },
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
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const extracted = JSON.parse(toolCall.function.arguments);
      console.log(`Extracted ${extracted.products?.length || 0} products`);
      return new Response(JSON.stringify({ products: extracted.products || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ products: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-competitor-pricelist error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
