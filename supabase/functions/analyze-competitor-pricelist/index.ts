import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Extracts text from a PDF using pdf-parse via esm.sh
 * Falls back to sending file URL directly for images
 */
async function extractPdfText(fileUrl: string): Promise<string> {
  console.log("Downloading PDF for text extraction...");
  const resp = await fetch(fileUrl);
  if (!resp.ok) throw new Error(`Failed to download file: ${resp.status}`);

  const arrayBuffer = await resp.arrayBuffer();
  const sizeMB = arrayBuffer.byteLength / 1024 / 1024;
  console.log(`PDF downloaded, size: ${sizeMB.toFixed(1)}MB`);

  // Use pdf.js-extract for text extraction - lighter than full pdf-parse
  // We'll use a simpler approach: send to Gemini as base64 in smaller chunks
  // Actually, let's use the pdf-parse library
  const { default: pdfParse } = await import("https://esm.sh/pdf-parse@1.1.1");
  
  const buffer = new Uint8Array(arrayBuffer);
  const data = await pdfParse(buffer);
  
  console.log(`Extracted ${data.text.length} chars from ${data.numpages} pages`);
  return data.text;
}

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

    console.log(`Searching competitor pricelist: ${fileName}, query: ${query}, isPdf: ${isPdf}`);

    const systemPrompt = `Sei un assistente esperto nell'analisi di listini prezzi di competitor nel settore dei forni professionali, abbattitori di temperatura e attrezzature per la ristorazione.

Ti viene fornito un documento (listino prezzi) e una domanda dell'utente. Rispondi in modo preciso e dettagliato basandoti ESCLUSIVAMENTE sul contenuto del documento.

Regole:
- Rispondi sempre in italiano
- Se trovi prezzi, riportali esattamente come nel documento
- Se trovi specifiche tecniche, elencale in modo chiaro
- Se la risposta non è nel documento, dillo chiaramente
- Formatta la risposta in modo leggibile usando elenchi puntati quando appropriato
- Sii conciso ma completo`;

    let userContent: any;

    if (isPdf) {
      // Extract text from PDF - memory efficient, no base64 needed
      let pdfText: string;
      try {
        pdfText = await extractPdfText(fileUrl);
      } catch (extractErr) {
        console.error("PDF text extraction failed:", extractErr);
        return new Response(JSON.stringify({ error: "Impossibile estrarre il testo dal PDF. Il file potrebbe essere un PDF basato su immagini." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!pdfText || pdfText.trim().length < 50) {
        return new Response(JSON.stringify({ error: "Il PDF non contiene testo estraibile. Potrebbe essere un PDF basato su immagini/scansioni." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Truncate if extremely long to stay within token limits
      const maxChars = 100000;
      const truncatedText = pdfText.length > maxChars 
        ? pdfText.substring(0, maxChars) + "\n\n[... testo troncato per limiti di dimensione ...]" 
        : pdfText;

      userContent = `Contenuto del documento "${fileName}":\n\n${truncatedText}\n\n---\n\nDomanda: ${query}`;
    } else {
      // For images, pass URL directly
      userContent = [
        { type: "text", text: query },
        { type: "image_url", image_url: { url: fileUrl } },
      ];
    }

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
