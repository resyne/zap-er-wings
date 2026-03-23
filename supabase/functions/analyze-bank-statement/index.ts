import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { read, utils } from "npm:xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Try to parse a date string into YYYY-MM-DD
function parseDate(raw: any): string | null {
  if (!raw) return null;
  const s = String(raw).trim();

  // DD/MM/YYYY or DD-MM-YYYY
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const d = new Date(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }

  // YYYY-MM-DD
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // Excel serial date number
  const num = Number(s);
  if (!isNaN(num) && num > 40000 && num < 60000) {
    const d = new Date((num - 25569) * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }

  // Try native parse
  const d = new Date(s);
  if (!isNaN(d.getTime()) && d.getFullYear() > 2000) return d.toISOString().split("T")[0];

  return null;
}

function parseAmount(raw: any): number {
  if (raw == null || raw === "") return 0;
  let s = String(raw).trim();
  // Remove currency symbols and spaces
  s = s.replace(/[€$£\s]/g, "");
  // Handle Italian format: 1.234,56 → 1234.56
  if (s.includes(",") && s.includes(".")) {
    // If comma comes after last dot: 1.234,56 (Italian)
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // 1,234.56 (English)
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(",") && !s.includes(".")) {
    // Could be 1234,56 (decimal comma) or 1,234 (thousand separator)
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      s = s.replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Find the best matching column key from a list of patterns
function findCol(keys: string[], patterns: string[]): string | undefined {
  const lower = keys.map(k => k.toLowerCase().trim());
  for (const p of patterns) {
    const idx = lower.findIndex(k => k === p);
    if (idx >= 0) return keys[idx];
  }
  for (const p of patterns) {
    const idx = lower.findIndex(k => k.includes(p));
    if (idx >= 0) return keys[idx];
  }
  return undefined;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const direction = formData.get("direction") as string || "outflow";

    if (!file) {
      return new Response(JSON.stringify({ error: "File richiesto" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (file.size > 20 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "File troppo grande (max 20MB)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileBuffer = await file.arrayBuffer();
    const mimeType = file.type || "";
    const isExcel = mimeType.includes("spreadsheet") || mimeType.includes("excel") || file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    const isCsv = mimeType.includes("csv") || file.name.endsWith(".csv");
    const isSpreadsheet = isExcel || isCsv;

    // ─── SPREADSHEET: deterministic parse + AI only for ambiguous tipo ───
    if (isSpreadsheet) {
      let rows: Record<string, any>[] = [];

      if (isCsv) {
        const text = new TextDecoder("utf-8").decode(fileBuffer);
        // Minimal CSV → rows
        const wb = read(text, { type: "string" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = utils.sheet_to_json(sheet, { raw: false, defval: "" });
      } else {
        const wb = read(new Uint8Array(fileBuffer), { type: "array" });
        // Try all sheets, pick one with most data
        let bestRows: any[] = [];
        for (const name of wb.SheetNames) {
          const r = utils.sheet_to_json(wb.Sheets[name], { raw: false, defval: "" }) as any[];
          if (r.length > bestRows.length) bestRows = r;
        }
        rows = bestRows;
      }

      if (rows.length === 0) {
        return new Response(JSON.stringify({ error: "Il file non contiene dati" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const keys = Object.keys(rows[0]);
      console.log(`Excel columns: ${keys.join(", ")}`);
      console.log(`Total rows: ${rows.length}`);

      // Detect columns
      const dateCol = findCol(keys, ["data operazione", "data mov", "data movimento", "data contabile", "data", "date", "operazione"]);
      const valutaCol = findCol(keys, ["data valuta", "valuta"]);
      const descCol = findCol(keys, ["descrizione", "descrizione operazione", "causale", "dettaglio", "motivo", "oggetto", "description"]);
      const dareCol = findCol(keys, ["dare", "addebiti", "addebito", "uscite", "debit"]);
      const avereCol = findCol(keys, ["avere", "accrediti", "accredito", "entrate", "credit"]);
      const importoCol = findCol(keys, ["importo", "amount", "ammontare", "totale", "movimento"]);
      const refCol = findCol(keys, ["riferimento", "reference", "cro", "trn", "numero operazione"]);
      const saldoCol = findCol(keys, ["saldo", "saldo contabile", "saldo disponibile", "disponibilità"]);

      // Determine if we have separate dare/avere or single importo
      const hasDareAvere = !!(dareCol && avereCol);
      const hasImporto = !!importoCol;

      if (!hasDareAvere && !hasImporto) {
        // Fallback: look for any numeric column that's not saldo/date
        const numericCols = keys.filter(k => {
          if (k === dateCol || k === valutaCol || k === descCol || k === refCol || k === saldoCol) return false;
          const sample = rows.slice(0, 5).find(r => r[k] && parseAmount(r[k]) !== 0);
          return !!sample;
        });
        if (numericCols.length === 0) {
          // Can't parse deterministically - fall through to AI
          console.log("Cannot detect amount columns, falling back to AI");
        }
      }

      console.log(`Detected cols - date:${dateCol} valuta:${valutaCol} desc:${descCol} dare:${dareCol} avere:${avereCol} importo:${importoCol} ref:${refCol}`);

      const movements: any[] = [];
      let descBuffer = ""; // For multi-line descriptions

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        // Try to get date
        const rawDate = dateCol ? row[dateCol] : null;
        const parsedDate = parseDate(rawDate);
        const rawValuta = valutaCol ? row[valutaCol] : null;
        const parsedValuta = parseDate(rawValuta);

        // Get amounts
        let amount = 0;
        let tipo: "entrata" | "uscita" = "entrata";

        if (hasDareAvere) {
          const dareAmt = parseAmount(row[dareCol!]);
          const avereAmt = parseAmount(row[avereCol!]);
          if (dareAmt !== 0 && avereAmt === 0) {
            amount = Math.abs(dareAmt);
            tipo = "uscita";
          } else if (avereAmt !== 0 && dareAmt === 0) {
            amount = Math.abs(avereAmt);
            tipo = "entrata";
          } else if (dareAmt !== 0 && avereAmt !== 0) {
            // Both have values - unusual, take the larger
            if (Math.abs(dareAmt) >= Math.abs(avereAmt)) {
              amount = Math.abs(dareAmt);
              tipo = "uscita";
            } else {
              amount = Math.abs(avereAmt);
              tipo = "entrata";
            }
          }
        } else if (hasImporto) {
          const raw = parseAmount(row[importoCol!]);
          amount = Math.abs(raw);
          tipo = raw < 0 ? "uscita" : "entrata";
        }

        // Get description
        const desc = descCol ? String(row[descCol] || "").trim() : "";
        const ref = refCol ? String(row[refCol] || "").trim() : "";

        // Build full description from all text columns
        let fullDesc = desc;
        if (!fullDesc) {
          // Concatenate all non-numeric, non-date columns as description
          const textParts = keys
            .filter(k => k !== dateCol && k !== valutaCol && k !== dareCol && k !== avereCol && k !== importoCol && k !== saldoCol && k !== refCol)
            .map(k => String(row[k] || "").trim())
            .filter(Boolean);
          fullDesc = textParts.join(" - ");
        }

        // Skip rows with no amount and no date (likely header or summary rows)
        if (amount === 0 && !parsedDate) {
          // Could be a continuation line - append to buffer
          if (fullDesc) descBuffer += " " + fullDesc;
          continue;
        }

        // If we have amount but no date, it might still be valid with a previous date context
        if (amount === 0) {
          if (fullDesc) descBuffer += " " + fullDesc;
          continue;
        }

        // Skip saldo/totale rows
        const lowerDesc = fullDesc.toLowerCase();
        if (lowerDesc.includes("saldo iniziale") || lowerDesc.includes("saldo finale") || 
            lowerDesc.includes("totale generale") || lowerDesc === "saldo") {
          continue;
        }

        // Use buffered description from previous continuation lines
        if (descBuffer) {
          fullDesc = fullDesc + descBuffer;
          descBuffer = "";
        }

        const movDate = parsedDate || (movements.length > 0 ? movements[movements.length - 1].data_movimento : new Date().toISOString().split("T")[0]);

        const movDirection = tipo === "uscita" ? "outflow" : "inflow";

        movements.push({
          data_movimento: movDate,
          data_valuta: parsedValuta || movDate,
          descrizione: fullDesc || `Movimento ${i + 1}`,
          importo: amount,
          tipo,
          riferimento: ref || undefined,
          direction: movDirection,
          relevant: movDirection === direction,
        });
      }

      console.log(`Deterministic parse extracted ${movements.length} movements from ${rows.length} rows`);

      // If deterministic parse found nothing or very few, fall back to AI
      if (movements.length < 3 && rows.length > 5) {
        console.log("Deterministic parse found too few results, falling back to AI for full extraction");
        // Fall through to AI extraction below
      } else {
        return new Response(JSON.stringify({
          success: true,
          bank_name: null,
          account_iban: null,
          period: movements.length > 0
            ? `${movements[0].data_movimento} - ${movements[movements.length - 1].data_movimento}`
            : null,
          total_movements: movements.length,
          movements,
          direction,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ─── AI EXTRACTION for PDF/images or spreadsheet fallback ───
    const systemPrompt = `Sei un esperto contabile italiano. Analizza l'estratto conto ed estrai TUTTI i movimenti.

Per ogni movimento:
- data_movimento: YYYY-MM-DD
- data_valuta: YYYY-MM-DD (se presente)
- descrizione: causale completa
- importo: valore assoluto positivo
- tipo: "entrata" o "uscita"
- riferimento: CRO/TRN se presente

REGOLE: Estrai OGNI riga inclusi bonifici, versamenti assegni, commissioni, addebiti SDD, POS, prelievi, F24, giroconti, interessi. NON saltare nessuna voce. Importi sempre positivi.`;

    const toolDef = {
      type: "function",
      function: {
        name: "extract_bank_movements",
        description: "Extract ALL bank movements",
        parameters: {
          type: "object",
          properties: {
            bank_name: { type: "string" },
            account_iban: { type: "string" },
            period: { type: "string" },
            movements: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  data_movimento: { type: "string" },
                  data_valuta: { type: "string" },
                  descrizione: { type: "string" },
                  importo: { type: "number" },
                  tipo: { type: "string", enum: ["entrata", "uscita"] },
                  riferimento: { type: "string" },
                },
                required: ["data_movimento", "descrizione", "importo", "tipo"],
              },
            },
            total_movements: { type: "number" },
          },
          required: ["movements", "total_movements"],
        },
      },
    };

    let userContent: any[];

    if (isSpreadsheet) {
      // Fallback: send text to AI
      let textContent = "";
      if (isCsv) {
        textContent = new TextDecoder("utf-8").decode(fileBuffer);
      } else {
        const wb = read(new Uint8Array(fileBuffer), { type: "array" });
        for (const name of wb.SheetNames) {
          textContent += `--- ${name} ---\n`;
          textContent += utils.sheet_to_csv(wb.Sheets[name], { FS: "|", blankrows: false }) + "\n\n";
        }
      }
      if (textContent.length > 120000) textContent = textContent.substring(0, 120000);
      userContent = [{ type: "text", text: `Estrai TUTTI i movimenti da questo estratto conto:\n\n${textContent}` }];
    } else {
      const bytes = new Uint8Array(fileBuffer);
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const b64 = btoa(bin);
      const mime = mimeType || "application/pdf";
      userContent = [
        { type: "text", text: "Estrai TUTTI i movimenti dall'estratto conto. Includi versamenti, commissioni, addebiti, bonifici, assegni, POS, prelievi." },
        { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } },
      ];
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
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

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI error:", aiResp.status, errText);
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Troppi tentativi. Riprova." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI error: ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("Nessun dato estratto dall'AI");

    const extracted = JSON.parse(toolCall.function.arguments);
    const cleaned = (extracted.movements || [])
      .filter((m: any) => m.importo && m.importo > 0 && m.data_movimento)
      .map((m: any) => {
        const d = m.tipo === "uscita" ? "outflow" : "inflow";
        return { ...m, importo: Math.abs(m.importo), direction: d, relevant: d === direction };
      });

    console.log(`AI extracted ${cleaned.length} movements`);

    return new Response(JSON.stringify({
      success: true,
      bank_name: extracted.bank_name || null,
      account_iban: extracted.account_iban || null,
      period: extracted.period || null,
      total_movements: cleaned.length,
      movements: cleaned,
      direction,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("analyze-bank-statement error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
