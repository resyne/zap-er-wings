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

  // DD/MM/YY or DD-MM-YY
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/);
  if (m) {
    const yy = Number(m[3]);
    const fullYear = yy <= 69 ? 2000 + yy : 1900 + yy;
    const d = new Date(`${fullYear}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`);
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
  const hasTrailingMinus = s.endsWith("-");
  const hasParenthesisNegative = /^\(.*\)$/.test(s);

  // Remove currency symbols and spaces
  s = s.replace(/[€$£\s()]/g, "");
  if (hasTrailingMinus) s = s.slice(0, -1);

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
  if (isNaN(n)) return 0;
  const isNegative = hasTrailingMinus || hasParenthesisNegative;
  return isNegative ? -Math.abs(n) : n;
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

type MovementType = "entrata" | "uscita";

function normalizeMovementDescription(v: any): string {
  return String(v || "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferDirectionFromDescription(description: string, fallbackDirection: "inflow" | "outflow"): MovementType {
  const text = description.toLowerCase();

  const inflowHints = [
    "bonifico disposto da",
    "bonifico ricevuto",
    "accredito",
    "versamento",
    "incasso",
    "assegni vers",
    "stipendio",
    "rimborso",
  ];

  const outflowHints = [
    "bonifico disposto a",
    "bonifico istantaneo da voi disposto",
    "bonifico a favore di",
    "addebito",
    "pagamento",
    "commission",
    "prelievo",
    "f24",
    "giroconto",
    "rid",
    "sdd",
    "mav",
    "rav",
  ];

  if (inflowHints.some(h => text.includes(h))) return "entrata";
  if (outflowHints.some(h => text.includes(h))) return "uscita";

  return fallbackDirection === "inflow" ? "entrata" : "uscita";
}

function computePeriodFromMovements(movements: Array<{ data_movimento: string }>): string | null {
  if (!movements.length) return null;
  const dates = movements
    .map(m => m.data_movimento)
    .filter(Boolean)
    .sort();
  if (!dates.length) return null;
  return `${dates[0]} - ${dates[dates.length - 1]}`;
}

function movementKey(m: {
  data_movimento: string;
  importo: number;
  descrizione: string;
  tipo: MovementType;
}): string {
  const desc = normalizeMovementDescription(m.descrizione).toLowerCase().slice(0, 120);
  return `${m.data_movimento}|${m.importo.toFixed(2)}|${m.tipo}|${desc}`;
}

function extractSpreadsheetMovements(
  fileBuffer: ArrayBuffer,
  direction: "inflow" | "outflow",
): Array<{
  data_movimento: string;
  data_valuta: string | null;
  descrizione: string;
  importo: number;
  tipo: MovementType;
  riferimento: string | null;
}> {
  const wb = read(new Uint8Array(fileBuffer), { type: "array" });
  const allMovements: Array<{
    data_movimento: string;
    data_valuta: string | null;
    descrizione: string;
    importo: number;
    tipo: MovementType;
    riferimento: string | null;
  }> = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = rowsFromSheet(sheet);
    console.log(`Sheet "${sheetName}": ${rows.length} rows found`);
    if (!rows.length) continue;

    const keys = Object.keys(rows[0] || {}).filter(Boolean);
    console.log(`Keys: ${JSON.stringify(keys.slice(0, 20))}`);
    if (!keys.length) continue;

    let dateCol = findCol(keys, ["data movimento", "data operazione", "data contabile", "data", "operazione", "date"]);
    if (!dateCol) dateCol = inferDateCol(keys, rows);

    const valueDateCol = findCol(keys, ["data valuta", "valuta"]);
    const descCol = findCol(keys, ["descrizione", "causale", "dettaglio", "narrativa", "oggetto", "motivo"]);
    const refCol = findCol(keys, ["cro", "trn", "riferimento", "id operazione", "numero operazione"]);

    const debitCol = findCol(keys, ["dare", "addebito", "uscita", "uscite", "debit"]);
    const creditCol = findCol(keys, ["avere", "accredito", "entrata", "entrate", "credit"]);

    const excluded = [dateCol, valueDateCol, descCol, refCol, debitCol, creditCol].filter(Boolean) as string[];
    const amountCandidates = inferAmountCols(keys, rows, excluded);
    const amountCol = findCol(keys, ["importo", "amount", "valore", "saldo"]) || amountCandidates[0];

    console.log(`Cols detected → date: ${dateCol}, valuta: ${valueDateCol}, desc: ${descCol}, debit: ${debitCol}, credit: ${creditCol}, amount: ${amountCol}, ref: ${refCol}`);

    // Log first 3 rows for debugging
    for (let i = 0; i < Math.min(3, rows.length); i++) {
      console.log(`Row ${i}: ${JSON.stringify(rows[i])}`);
    }

    let dateFailCount = 0;
    let amountFailCount = 0;
    const dateFailExamples: string[] = [];

    for (const row of rows) {
      const rawDate = (dateCol && row[dateCol]) || (valueDateCol && row[valueDateCol]);
      const movementDate = parseDate(rawDate);
      if (!movementDate) {
        dateFailCount++;
        if (dateFailExamples.length < 6) dateFailExamples.push(String(rawDate ?? "<empty>"));
        continue;
      }

      const valueDate = parseDate(valueDateCol ? row[valueDateCol] : null);

      let description = normalizeMovementDescription(descCol ? row[descCol] : "");
      if (!description) {
        const fallbackParts = keys
          .filter(k => ![dateCol, valueDateCol, debitCol, creditCol, amountCol, refCol].includes(k))
          .map(k => normalizeMovementDescription(row[k]))
          .filter(Boolean);
        description = fallbackParts.slice(0, 3).join(" - ");
      }
      if (!description) description = "Movimento bancario";

      const reference = normalizeMovementDescription(refCol ? row[refCol] : "") || null;

      const debit = debitCol ? Math.abs(parseAmount(row[debitCol])) : 0;
      const credit = creditCol ? Math.abs(parseAmount(row[creditCol])) : 0;

      if (debit > 0 || credit > 0) {
        if (debit > 0) {
          allMovements.push({
            data_movimento: movementDate,
            data_valuta: valueDate,
            descrizione: description,
            importo: debit,
            tipo: "uscita",
            riferimento: reference,
          });
        }
        if (credit > 0) {
          allMovements.push({
            data_movimento: movementDate,
            data_valuta: valueDate,
            descrizione: description,
            importo: credit,
            tipo: "entrata",
            riferimento: reference,
          });
        }
        continue;
      }

      if (!amountCol) continue;
      const rawAmount = parseAmount(row[amountCol]);
      if (!rawAmount) {
        amountFailCount++;
        continue;
      }

      let tipo: MovementType;
      if (rawAmount < 0) {
        tipo = "uscita";
      } else {
        const amountColName = amountCol.toLowerCase();
        if (amountColName.includes("dare") || amountColName.includes("addeb")) {
          tipo = "uscita";
        } else if (amountColName.includes("avere") || amountColName.includes("accredit") || amountColName.includes("entrat")) {
          tipo = "entrata";
        } else {
          tipo = inferDirectionFromDescription(description, direction);
        }
      }

      allMovements.push({
        data_movimento: movementDate,
        data_valuta: valueDate,
        descrizione: description,
        importo: Math.abs(rawAmount),
        tipo,
        riferimento: reference,
      });
    }
    console.log(`Sheet "${sheetName}" stats: dateFailCount=${dateFailCount}, amountFailCount=${amountFailCount}, dateFailExamples=${JSON.stringify(dateFailExamples)}, movements so far=${allMovements.length}`);
  }

  const seen = new Set<string>();
  return allMovements.filter(m => {
    const key = movementKey(m);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const direction = (formData.get("direction") as string || "outflow") as "inflow" | "outflow";

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

    if (isSpreadsheet) {
      const parsedMovements = extractSpreadsheetMovements(fileBuffer, direction)
        .filter(m => m.importo > 0 && m.data_movimento)
        .map((m) => {
          const d = m.tipo === "uscita" ? "outflow" : "inflow";
          return { ...m, direction: d, relevant: d === direction };
        });

      if (parsedMovements.length > 0) {
        console.log(`Spreadsheet parser extracted ${parsedMovements.length} movements`);
        return new Response(JSON.stringify({
          success: true,
          bank_name: null,
          account_iban: null,
          period: computePeriodFromMovements(parsedMovements),
          total_movements: parsedMovements.length,
          movements: parsedMovements,
          direction,
          source: "spreadsheet-parser",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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
