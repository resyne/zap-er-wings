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

function normalizeText(v: any): string {
  return String(v || "").toLowerCase().trim();
}

function detectHeaderRowIndex(matrix: any[][]): number {
  const dateWords = ["data", "date", "valuta", "operazione", "contabile"];
  const descWords = ["descrizione", "causale", "dettaglio", "oggetto", "motivo", "narrativa"];
  const amountWords = ["importo", "dare", "avere", "addebito", "accredito", "entrate", "uscite", "saldo"];

  let bestIndex = -1;
  let bestScore = 0;

  for (let i = 0; i < Math.min(matrix.length, 40); i++) {
    const row = (matrix[i] || []).map(normalizeText).filter(Boolean);
    if (row.length < 2) continue;

    const hasDate = row.some(c => dateWords.some(w => c.includes(w)));
    const hasDesc = row.some(c => descWords.some(w => c.includes(w)));
    const amountMatches = row.filter(c => amountWords.some(w => c.includes(w))).length;

    const score = (hasDate ? 2 : 0) + (hasDesc ? 2 : 0) + Math.min(amountMatches, 3);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestScore >= 3 ? bestIndex : -1;
}

function rowsFromSheet(sheet: any): Record<string, any>[] {
  const matrix = utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "", blankrows: false }) as any[][];
  const headerRowIndex = detectHeaderRowIndex(matrix);

  if (headerRowIndex >= 0) {
    console.log(`Detected header row at index ${headerRowIndex}`);
    return utils.sheet_to_json(sheet, {
      raw: false,
      defval: "",
      range: headerRowIndex,
    }) as Record<string, any>[];
  }

  return utils.sheet_to_json(sheet, { raw: false, defval: "" }) as Record<string, any>[];
}

function inferDateCol(keys: string[], rows: Record<string, any>[]): string | undefined {
  let bestKey: string | undefined;
  let bestCount = 0;
  for (const k of keys) {
    const count = rows.slice(0, 200).filter(r => parseDate(r[k])).length;
    if (count > bestCount) {
      bestCount = count;
      bestKey = k;
    }
  }
  return bestCount >= 3 ? bestKey : undefined;
}

function inferAmountCols(keys: string[], rows: Record<string, any>[], excluded: string[] = []): string[] {
  return keys
    .filter(k => !excluded.includes(k))
    .map(k => ({
      key: k,
      count: rows.slice(0, 500).filter(r => parseAmount(r[k]) !== 0).length,
    }))
    .filter(x => x.count >= 3)
    .sort((a, b) => b.count - a.count)
    .map(x => x.key);
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

    // ─── Always use AI for extraction (deterministic parse was unreliable for entrata/uscita) ───

    // ─── AI EXTRACTION for PDF/images or spreadsheet fallback ───
    const systemPrompt = `Sei un esperto contabile italiano. Analizza l'estratto conto bancario ed estrai TUTTI i movimenti senza eccezioni.

Per ogni movimento:
- data_movimento: YYYY-MM-DD
- data_valuta: YYYY-MM-DD (se presente)
- descrizione: causale completa
- importo: valore assoluto positivo (senza segno)
- tipo: "entrata" (soldi ricevuti sul conto: bonifici in arrivo, versamenti, accrediti, incassi) o "uscita" (soldi usciti dal conto: bonifici in uscita, addebiti, pagamenti, commissioni, F24)
- riferimento: CRO/TRN se presente

REGOLE IMPORTANTI:
1. Estrai OGNI singola riga di movimento, inclusi: bonifici, versamenti assegni, commissioni bancarie, addebiti SDD, pagamenti POS, prelievi ATM, F24, giroconti, interessi, competenze, bolli.
2. NON saltare nessuna voce.
3. Gli importi devono essere sempre POSITIVI (valore assoluto).
4. Per determinare entrata/uscita: se nella colonna "Dare" c'è un valore è una USCITA, se nella colonna "Avere" c'è un valore è una ENTRATA. Se c'è una sola colonna importo: importi negativi = uscita, positivi = entrata.
5. Versamenti assegni, bonifici ricevuti, accrediti stipendio = ENTRATA.
6. Commissioni, addebiti, bonifici disposti, F24, pagamenti = USCITA.`;

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
