import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { supplierId, query } = await req.json();
    if (!supplierId || !query) {
      return new Response(JSON.stringify({ error: "supplierId and query are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // List files in supplier's price list folder
    const folderPath = `supplier-pricelists/${supplierId}`;
    const { data: files, error: listError } = await supabase.storage
      .from("company-documents")
      .list(folderPath, { limit: 50 });

    if (listError) throw listError;

    const validFiles = (files || []).filter(f => f.name !== ".emptyFolderPlaceholder");
    if (validFiles.length === 0) {
      return new Response(JSON.stringify({ result: "Nessun listino caricato per questo fornitore. Carica prima i listini prezzi." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download text content from files (PDFs won't have readable text, but xlsx/csv might)
    // We'll send file names and try to download content for text-based files
    const fileContents: string[] = [];
    
    for (const file of validFiles.slice(0, 10)) {
      const filePath = `${folderPath}/${file.name}`;
      try {
        const { data: fileData, error: dlError } = await supabase.storage
          .from("company-documents")
          .download(filePath);
        
        if (dlError || !fileData) continue;

        // For text-based files, read content
        const mimeType = file.metadata?.mimetype || "";
        if (mimeType.includes("text") || file.name.endsWith(".csv") || file.name.endsWith(".txt")) {
          const text = await fileData.text();
          fileContents.push(`--- File: ${file.name} ---\n${text.substring(0, 15000)}`);
        } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
          // Convert to base64 for AI to process
          const arrayBuffer = await fileData.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer).slice(0, 50000)));
          fileContents.push(`--- File: ${file.name} (Excel, base64 first 50KB) ---\n[Binary Excel file - filename suggests pricing data]`);
        } else if (file.name.endsWith(".pdf")) {
          fileContents.push(`--- File: ${file.name} (PDF) ---\n[PDF file - cannot extract text directly]`);
        } else {
          fileContents.push(`--- File: ${file.name} ---\n[Binary file]`);
        }
      } catch (e) {
        console.error(`Error processing file ${file.name}:`, e);
        fileContents.push(`--- File: ${file.name} ---\n[Error reading file]`);
      }
    }

    const fileList = validFiles.map(f => f.name).join(", ");

    const systemPrompt = `Sei un assistente specializzato nella ricerca di prezzi nei listini fornitori. 
L'utente cerca informazioni su materiali/prodotti nei listini del fornitore.
File disponibili: ${fileList}

${fileContents.length > 0 ? "Contenuto dei file:\n" + fileContents.join("\n\n") : "Non è stato possibile leggere il contenuto dei file."}

Rispondi in italiano. Se non trovi il materiale specifico, suggerisci materiali simili se presenti. 
Se i file sono binari (PDF/Excel) e non riesci a leggerne il contenuto, indica all'utente quali file potrebbero contenere l'informazione cercata basandoti sui nomi dei file.
Sii conciso e diretto.`;

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
          { role: "user", content: `Cerca nei listini: ${query}` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Troppe richieste, riprova tra poco." }), {
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
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const result = aiData.choices?.[0]?.message?.content || "Nessun risultato trovato.";

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("search-supplier-pricelist error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
