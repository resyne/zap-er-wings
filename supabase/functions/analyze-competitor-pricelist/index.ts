import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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

    const model = "google/gemini-2.5-flash";
    const isPdf = (fileName || "").toLowerCase().endsWith(".pdf");
    let contentUrl = fileUrl;

    if (isPdf) {
      console.log("Downloading PDF for base64 conversion...");
      const pdfResp = await fetch(fileUrl);
      if (!pdfResp.ok) throw new Error(`Failed to download file: ${pdfResp.status}`);

      // Check size via Content-Length header first to avoid downloading huge files
      const contentLength = parseInt(pdfResp.headers.get("content-length") || "0");
      const maxSize = 10 * 1024 * 1024; // 10MB limit for edge function memory safety
      if (contentLength > maxSize) {
        await pdfResp.body?.cancel();
        return new Response(JSON.stringify({ error: "File troppo grande (max 10MB). Prova con un file più piccolo." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const pdfBytes = new Uint8Array(await pdfResp.arrayBuffer());
      if (pdfBytes.byteLength > maxSize) {
        return new Response(JSON.stringify({ error: "File troppo grande (max 10MB)." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Use Deno's efficient base64 encoding (no string concatenation)
      const base64 = encodeBase64(pdfBytes);
      contentUrl = `data:application/pdf;base64,${base64}`;
      console.log(`PDF converted, size: ${(pdfBytes.byteLength / 1024 / 1024).toFixed(1)}MB`);
    }

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
              { type: "text", text: query },
              { type: "image_url", image_url: { url: contentUrl } },
            ],
          },
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
