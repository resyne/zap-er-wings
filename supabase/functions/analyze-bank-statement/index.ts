import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { read, utils } from "npm:xlsx@0.18.5";

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

    if (file.size > 20 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "File troppo grande (max 20MB)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileBuffer = await file.arrayBuffer();
    const mimeType = file.type || "";
    const isExcel = mimeType.includes("spreadsheet") || mimeType.includes("excel") || file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    const isCsv = mimeType.includes("csv") || file.name.endsWith(".csv");

    const systemPrompt = `Sei un esperto contabile italiano specializzato nell'analisi di estratti conto bancari.

Analizza il documento dell'estratto conto bancario fornito ed estrai TUTTI i movimenti presenti, NESSUNO ESCLUSO.

Per ogni movimento estrai:
- data_movimento: data del movimento in formato YYYY-MM-DD
- data_valuta: data valuta in formato YYYY-MM-DD (se presente, altrimenti uguale a data_movimento)
- descrizione: descrizione/causale COMPLETA del movimento (includi tutti i dettagli: beneficiario, causale, riferimenti)
- importo: importo in valore assoluto (sempre positivo, mai zero)
- tipo: "entrata" o "uscita" basato sul segno o sulla colonna
- riferimento: eventuale riferimento CRO/TRN/numero operazione (se presente nella descrizione, estrailo)
- conto_bancario: IBAN o numero conto se visibile nel documento

REGOLE CRITICHE:
1. Estrai OGNI SINGOLA RIGA di movimento, inclusi:
   - Bonifici (in entrata e uscita)
   - Versamenti assegni e contanti
   - Addebiti utenze (bollette, SDD, RID)
   - Commissioni bancarie, bolli, spese conto
   - Stipendi e pagamenti stipendi
   - Prelievi bancomat/ATM
   - Pagamenti POS/carte
   - Giroconti
   - Pagamenti F24/tributi
   - Interessi attivi e passivi
   - Qualsiasi altro tipo di operazione bancaria
2. NON saltare righe che sembrano "irrilevanti" come commissioni, bolli, arrotondamenti
3. Se una riga ha importo ZERO o è un saldo/totale, IGNORALA
4. Se il formato ha colonne DARE e AVERE separate: importo in DARE = uscita, importo in AVERE = entrata
5. Se c'è una sola colonna importo: negativi = uscite, positivi = entrate
6. Se il segno non è chiaro, usa il contesto della descrizione (es. "versamento" = entrata, "addebito" = uscita, "pagamento" = uscita, "accredito" = entrata, "bonifico a favore" = entrata, "bonifico disposto" = uscita)
7. Le date devono essere in formato YYYY-MM-DD
8. NON inventare dati, estrai solo quello che vedi
9. Se ci sono righe di dettaglio sotto una riga principale (es. beneficiario su riga successiva), uniscile in un'unica voce
10. Importi: rimuovi punti separatori migliaia e usa il punto come separatore decimale (es. "1.234,56" → 1234.56)`;

    const toolDef = {
      type: "function",
      function: {
        name: "extract_bank_movements",
        description: "Extract ALL bank movements from the statement without exception",
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
                  descrizione: { type: "string", description: "Descrizione/causale completa" },
                  importo: { type: "number", description: "Importo in valore assoluto (sempre positivo)" },
                  tipo: { type: "string", enum: ["entrata", "uscita"], description: "Tipo movimento" },
                  riferimento: { type: "string", description: "Riferimento CRO/TRN/numero operazione" },
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
    };

    let userContent: any[];

    if (isExcel || isCsv) {
      let textContent = "";
      
      if (isCsv) {
        const decoder = new TextDecoder("utf-8");
        textContent = decoder.decode(fileBuffer);
      } else {
        const workbook = read(new Uint8Array(fileBuffer), { type: "array" });
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          // Use pipe separator for cleaner parsing, preserve empty cells
          const csv = utils.sheet_to_csv(sheet, { FS: "|", blankrows: false });
          textContent += `--- Foglio: ${sheetName} ---\n`;
          textContent += csv + "\n\n";
        }
      }

      // Better truncation - keep header + as many rows as possible
      if (textContent.length > 120000) {
        const lines = textContent.split("\n");
        let result = "";
        for (const line of lines) {
          if (result.length + line.length > 120000) break;
          result += line + "\n";
        }
        textContent = result;
      }
      
      userContent = [
        { type: "text", text: `Analizza questo estratto conto bancario ed estrai TUTTI i movimenti, nessuno escluso.

ATTENZIONE: Il file potrebbe contenere colonne con nomi diversi da quelli standard. Cerca colonne relative a:
- Date (data operazione, data contabile, data valuta, data mov., ecc.)
- Descrizioni/Causali (descrizione, causale, dettaglio, operazione, ecc.)
- Importi (importo, dare, avere, entrate, uscite, accrediti, addebiti, ammontare, ecc.)
- Saldi (saldo, disponibilità - IGNORA queste righe, non sono movimenti)

Se ci sono colonne DARE e AVERE separate, un importo nella colonna DARE è un'uscita, nella colonna AVERE è un'entrata.
Se c'è un'unica colonna importo con segni + e -, i positivi sono entrate e i negativi uscite.

Il file "${file.name}" contiene questi dati (colonne separate da |):

${textContent}` },
      ];
    } else {
      // PDF or image
      const fileBytes = new Uint8Array(fileBuffer);
      let binary = '';
      for (let i = 0; i < fileBytes.length; i++) {
        binary += String.fromCharCode(fileBytes[i]);
      }
      const fileBase64 = btoa(binary);
      const resolvedMime = mimeType || "application/pdf";
      const dataUrl = `data:${resolvedMime};base64,${fileBase64}`;

      userContent = [
        { type: "text", text: "Analizza questo estratto conto bancario ed estrai TUTTI i movimenti, nessuno escluso. Includi versamenti, commissioni, addebiti, bonifici, assegni, pagamenti POS, prelievi, e qualsiasi altro tipo di operazione." },
        { type: "image_url", image_url: { url: dataUrl } },
      ];
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
        tools: [toolDef],
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

    // Validate and clean movements
    const cleanedMovements = (extracted.movements || [])
      .filter((m: any) => m.importo && m.importo > 0 && m.data_movimento)
      .map((m: any) => {
        const movDirection = m.tipo === "uscita" ? "outflow" : "inflow";
        return {
          ...m,
          importo: Math.abs(m.importo),
          direction: movDirection,
          relevant: movDirection === direction,
        };
      });

    console.log(`Extracted ${cleanedMovements.length} movements from ${file.name} (AI reported ${extracted.total_movements})`);

    return new Response(JSON.stringify({
      success: true,
      bank_name: extracted.bank_name || null,
      account_iban: extracted.account_iban || null,
      period: extracted.period || null,
      total_movements: cleanedMovements.length,
      movements: cleanedMovements,
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
