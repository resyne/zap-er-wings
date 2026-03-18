import { useState, useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  FileSpreadsheet,
  Check,
  AlertTriangle,
  X,
  Link2,
  ChevronRight,
  ArrowRight,
  Loader2,
  CheckCircle,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────
export interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number; // positive = entrata, negative = uscita
  reference?: string;
}

interface Scadenza {
  id: string;
  tipo: "credito" | "debito";
  soggetto_nome: string | null;
  data_scadenza: string;
  importo_totale: number;
  importo_residuo: number;
  stato: string;
  invoice_number?: string;
}

type MatchStatus = "matched" | "possible" | "unmatched";

interface MatchResult {
  transaction: BankTransaction;
  status: MatchStatus;
  matchedScadenza: Scadenza | null;
  possibleMatches: Scadenza[];
  confidence: number; // 0-100
  confirmed: boolean;
}

type Step = "upload" | "mapping" | "review" | "done";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scadenze: Scadenza[];
  onConfirmMatches: (matches: Array<{ scadenzaId: string; importo: number; data: string }>) => Promise<void>;
}

// ─── Fuzzy match helpers ──────────────────────────────────────────
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

function fuzzyScore(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 100;
  if (na.includes(nb) || nb.includes(na)) return 80;
  
  const wordsA = na.split(" ").filter(w => w.length > 2);
  const wordsB = nb.split(" ").filter(w => w.length > 2);
  if (wordsA.length === 0 || wordsB.length === 0) return 0;
  
  const matches = wordsA.filter(wa => wordsB.some(wb => wb.includes(wa) || wa.includes(wb)));
  return Math.round((matches.length / Math.max(wordsA.length, wordsB.length)) * 70);
}

function matchTransactionToScadenze(tx: BankTransaction, scadenze: Scadenza[]): MatchResult {
  const isEntrata = tx.amount > 0;
  const absTxAmount = Math.abs(tx.amount);
  
  // Filter by type: entrata → crediti, uscita → debiti
  const candidates = scadenze.filter(s => {
    if (s.stato === "chiusa" || s.stato === "saldata") return false;
    return isEntrata ? s.tipo === "credito" : s.tipo === "debito";
  });

  const scored = candidates.map(s => {
    let score = 0;
    const residuo = Number(s.importo_residuo);
    
    // Amount match (most important)
    const amountDiff = Math.abs(absTxAmount - residuo);
    const amountPct = amountDiff / Math.max(residuo, 1);
    if (amountPct === 0) score += 50;
    else if (amountPct < 0.01) score += 40;
    else if (amountPct < 0.05) score += 25;
    else if (amountPct < 0.1) score += 10;
    
    // Name match
    if (s.soggetto_nome && tx.description) {
      score += Math.round(fuzzyScore(tx.description, s.soggetto_nome) * 0.4);
    }
    
    // Invoice number in description
    if (s.invoice_number && tx.description.includes(s.invoice_number)) {
      score += 20;
    }
    
    return { scadenza: s, score };
  }).filter(x => x.score > 15).sort((a, b) => b.score - a.score);

  if (scored.length > 0 && scored[0].score >= 60) {
    return {
      transaction: tx,
      status: "matched",
      matchedScadenza: scored[0].scadenza,
      possibleMatches: scored.slice(1, 4).map(s => s.scadenza),
      confidence: scored[0].score,
      confirmed: false,
    };
  }
  
  if (scored.length > 0) {
    return {
      transaction: tx,
      status: "possible",
      matchedScadenza: scored[0].scadenza,
      possibleMatches: scored.slice(0, 4).map(s => s.scadenza),
      confidence: scored[0].score,
      confirmed: false,
    };
  }

  return {
    transaction: tx,
    status: "unmatched",
    matchedScadenza: null,
    possibleMatches: [],
    confidence: 0,
    confirmed: false,
  };
}

// ─── Column mapping presets ───────────────────────────────────────
const COLUMN_PRESETS: Record<string, { date: string; description: string; amount: string; reference?: string }> = {
  auto: { date: "", description: "", amount: "" },
  intesa: { date: "Data operazione", description: "Descrizione", amount: "Importo" },
  unicredit: { date: "Data", description: "Descrizione operazione", amount: "Importo EUR" },
  generic_it: { date: "Data", description: "Descrizione", amount: "Importo" },
};

// ─── Component ────────────────────────────────────────────────────
export function BankReconciliationDialog({ open, onOpenChange, scadenze, onConfirmMatches }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [rawData, setRawData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [colMapping, setColMapping] = useState({ date: "", description: "", amount: "", reference: "" });
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const resetState = () => {
    setStep("upload");
    setRawData([]);
    setHeaders([]);
    setFileName("");
    setColMapping({ date: "", description: "", amount: "", reference: "" });
    setMatches([]);
  };

  // ─── File parsing ─────────────────────────────────────────────
  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
        
        if (json.length < 2) {
          toast.error("Il file non contiene dati sufficienti");
          return;
        }

        // Find header row (first row with > 2 non-empty cells)
        let headerIdx = 0;
        for (let i = 0; i < Math.min(json.length, 10); i++) {
          const nonEmpty = (json[i] || []).filter(c => c != null && String(c).trim() !== "").length;
          if (nonEmpty >= 3) { headerIdx = i; break; }
        }

        const foundHeaders = (json[headerIdx] || []).map(h => String(h || "").trim());
        const rows = json.slice(headerIdx + 1).filter(r => r.some(c => c != null && String(c).trim() !== ""));

        setHeaders(foundHeaders);
        setRawData(rows.map(r => r.map(c => String(c ?? ""))));

        // Try auto-mapping
        const lowerHeaders = foundHeaders.map(h => h.toLowerCase());
        const autoMap = { date: "", description: "", amount: "", reference: "" };
        
        for (const h of foundHeaders) {
          const lh = h.toLowerCase();
          if (!autoMap.date && (lh.includes("data") || lh.includes("date") || lh.includes("valuta"))) autoMap.date = h;
          if (!autoMap.description && (lh.includes("descri") || lh.includes("causale") || lh.includes("ordinante") || lh.includes("beneficiario"))) autoMap.description = h;
          if (!autoMap.amount && (lh.includes("import") || lh.includes("amount") || lh.includes("dare") || lh.includes("avere"))) autoMap.amount = h;
          if (!autoMap.reference && (lh.includes("riferimento") || lh.includes("rif") || lh.includes("cro") || lh.includes("trn"))) autoMap.reference = h;
        }

        setColMapping(autoMap);
        setStep("mapping");
        toast.success(`File caricato: ${rows.length} righe trovate`);
      } catch (err) {
        toast.error("Errore nel parsing del file");
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  // ─── Parse & Match ────────────────────────────────────────────
  const runMatching = () => {
    if (!colMapping.date || !colMapping.description || !colMapping.amount) {
      toast.error("Mappa almeno Data, Descrizione e Importo");
      return;
    }

    setIsProcessing(true);

    const dateIdx = headers.indexOf(colMapping.date);
    const descIdx = headers.indexOf(colMapping.description);
    const amountIdx = headers.indexOf(colMapping.amount);
    const refIdx = colMapping.reference ? headers.indexOf(colMapping.reference) : -1;

    const transactions: BankTransaction[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rawAmount = (row[amountIdx] || "").replace(/[^\d,.\-]/g, "").replace(",", ".");
      const amount = parseFloat(rawAmount);
      if (isNaN(amount) || amount === 0) continue;

      const rawDate = row[dateIdx] || "";
      // Try to parse date in various formats
      let parsedDate = rawDate;
      const ddmmyyyy = rawDate.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
      if (ddmmyyyy) {
        const year = ddmmyyyy[3].length === 2 ? "20" + ddmmyyyy[3] : ddmmyyyy[3];
        parsedDate = `${year}-${ddmmyyyy[2].padStart(2, "0")}-${ddmmyyyy[1].padStart(2, "0")}`;
      }

      transactions.push({
        id: `tx-${i}`,
        date: parsedDate,
        description: row[descIdx] || "",
        amount,
        reference: refIdx >= 0 ? row[refIdx] : undefined,
      });
    }

    if (transactions.length === 0) {
      toast.error("Nessuna transazione valida trovata");
      setIsProcessing(false);
      return;
    }

    // Match each transaction
    const openScadenze = scadenze.filter(s => s.stato !== "chiusa" && s.stato !== "saldata");
    const results = transactions.map(tx => matchTransactionToScadenze(tx, openScadenze));
    
    // Auto-confirm high-confidence matches
    results.forEach(r => {
      if (r.status === "matched" && r.confidence >= 80) {
        r.confirmed = true;
      }
    });

    setMatches(results);
    setStep("review");
    setIsProcessing(false);

    const matched = results.filter(r => r.status === "matched").length;
    const possible = results.filter(r => r.status === "possible").length;
    toast.success(`${matched} abbinamenti trovati, ${possible} da verificare`);
  };

  // ─── Confirm all ──────────────────────────────────────────────
  const confirmedMatches = matches.filter(m => m.confirmed && m.matchedScadenza);

  const handleConfirmAll = async () => {
    if (confirmedMatches.length === 0) {
      toast.error("Nessun abbinamento confermato");
      return;
    }

    setIsConfirming(true);
    try {
      await onConfirmMatches(
        confirmedMatches.map(m => ({
          scadenzaId: m.matchedScadenza!.id,
          importo: Math.abs(m.transaction.amount),
          data: m.transaction.date,
        }))
      );
      setStep("done");
    } catch (err) {
      toast.error("Errore durante la registrazione");
    } finally {
      setIsConfirming(false);
    }
  };

  // ─── Toggle match ─────────────────────────────────────────────
  const toggleConfirm = (txId: string) => {
    setMatches(prev => prev.map(m => 
      m.transaction.id === txId ? { ...m, confirmed: !m.confirmed } : m
    ));
  };

  const selectScadenza = (txId: string, scadenza: Scadenza) => {
    setMatches(prev => prev.map(m => 
      m.transaction.id === txId 
        ? { ...m, matchedScadenza: scadenza, status: "matched" as MatchStatus, confirmed: true }
        : m
    ));
  };

  // ─── Stats ────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: matches.length,
    matched: matches.filter(m => m.status === "matched").length,
    possible: matches.filter(m => m.status === "possible").length,
    unmatched: matches.filter(m => m.status === "unmatched").length,
    confirmed: confirmedMatches.length,
    totalAmount: confirmedMatches.reduce((s, m) => s + Math.abs(m.transaction.amount), 0),
  }), [matches, confirmedMatches]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Riconciliazione Bancaria
          </DialogTitle>
        </DialogHeader>

        {/* Progress steps */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground pb-2 border-b">
          {(["upload", "mapping", "review", "done"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              <span className={cn(
                "px-2 py-0.5 rounded-full transition-colors",
                step === s ? "bg-primary text-primary-foreground font-medium" : 
                (["upload","mapping","review","done"].indexOf(step) > i ? "text-foreground" : "")
              )}>
                {s === "upload" ? "1. Carica" : s === "mapping" ? "2. Mappa" : s === "review" ? "3. Verifica" : "4. Fatto"}
              </span>
            </div>
          ))}
        </div>

        <ScrollArea className="flex-1 pr-2">
          {/* STEP 1: Upload */}
          {step === "upload" && (
            <div className="py-8">
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all",
                  isDragActive
                    ? "border-primary bg-primary/5 scale-[1.02]"
                    : "border-muted-foreground/25 hover:border-primary hover:bg-accent/50"
                )}
              >
                <input {...getInputProps()} />
                <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="font-medium text-lg mb-1">
                  {isDragActive ? "Rilascia il file qui..." : "Carica estratto conto"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Trascina un file CSV o Excel (.xlsx) esportato dalla tua banca
                </p>
                <p className="text-xs text-muted-foreground mt-2">Max 10MB</p>
              </div>
            </div>
          )}

          {/* STEP 2: Column Mapping */}
          {step === "mapping" && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Mappa le colonne</p>
                  <p className="text-sm text-muted-foreground">
                    File: <span className="font-mono">{fileName}</span> — {rawData.length} righe
                  </p>
                </div>
                <Select onValueChange={(v) => {
                  if (v !== "auto" && COLUMN_PRESETS[v]) setColMapping({ ...COLUMN_PRESETS[v], reference: COLUMN_PRESETS[v].reference || "" });
                }}>
                  <SelectTrigger className="w-44 h-8">
                    <SelectValue placeholder="Preset banca..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect</SelectItem>
                    <SelectItem value="intesa">Intesa Sanpaolo</SelectItem>
                    <SelectItem value="unicredit">UniCredit</SelectItem>
                    <SelectItem value="generic_it">Generico IT</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "date" as const, label: "Data", required: true },
                  { key: "description" as const, label: "Descrizione / Causale", required: true },
                  { key: "amount" as const, label: "Importo", required: true },
                  { key: "reference" as const, label: "Riferimento (opz.)", required: false },
                ].map(({ key, label, required }) => (
                  <div key={key} className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      {label} {required && <span className="text-destructive">*</span>}
                    </label>
                    <Select value={colMapping[key]} onValueChange={(v) => setColMapping(prev => ({ ...prev, [key]: v }))}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Seleziona colonna..." />
                      </SelectTrigger>
                      <SelectContent>
                        {headers.map(h => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {/* Preview */}
              <div className="border rounded-lg overflow-hidden">
                <p className="text-xs font-medium text-muted-foreground px-3 py-2 bg-muted/30">Anteprima (prime 5 righe)</p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20">
                        {headers.map(h => (
                          <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rawData.slice(0, 5).map((row, i) => (
                        <TableRow key={i}>
                          {row.map((cell, j) => (
                            <TableCell key={j} className={cn(
                              "text-xs whitespace-nowrap",
                              headers[j] === colMapping.date && "bg-blue-50 font-medium",
                              headers[j] === colMapping.description && "bg-green-50 font-medium",
                              headers[j] === colMapping.amount && "bg-amber-50 font-medium",
                            )}>
                              {cell}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep("upload")}>Indietro</Button>
                <Button onClick={runMatching} disabled={isProcessing}>
                  {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Elaborazione...</> : <>Avvia Matching<ArrowRight className="h-4 w-4 ml-2" /></>}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Review */}
          {step === "review" && (
            <div className="space-y-4 py-4">
              {/* Stats bar */}
              <div className="grid grid-cols-4 gap-2">
                <div className="flex items-center gap-2 rounded-lg border bg-card p-2.5">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Abbinati</p>
                    <p className="font-bold text-sm text-emerald-700">{stats.matched}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border bg-card p-2.5">
                  <HelpCircle className="h-4 w-4 text-amber-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Da verificare</p>
                    <p className="font-bold text-sm text-amber-700">{stats.possible}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border bg-card p-2.5">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Non trovati</p>
                    <p className="font-bold text-sm text-red-600">{stats.unmatched}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border bg-card p-2.5">
                  <Check className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Confermati</p>
                    <p className="font-bold text-sm">{stats.confirmed}</p>
                  </div>
                </div>
              </div>

              {/* Match list */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="w-8"></TableHead>
                      <TableHead className="text-xs font-semibold">Mov. Bancario</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Importo</TableHead>
                      <TableHead className="text-xs font-semibold">→</TableHead>
                      <TableHead className="text-xs font-semibold">Scadenza Abbinata</TableHead>
                      <TableHead className="text-xs font-semibold">Stato</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matches.map((m) => (
                      <TableRow key={m.transaction.id} className={cn(
                        m.confirmed && "bg-emerald-50/50",
                        m.status === "unmatched" && "opacity-60"
                      )}>
                        <TableCell>
                          {m.matchedScadenza && (
                            <button
                              onClick={() => toggleConfirm(m.transaction.id)}
                              className={cn(
                                "h-5 w-5 rounded border-2 flex items-center justify-center transition-colors",
                                m.confirmed 
                                  ? "bg-emerald-600 border-emerald-600 text-white" 
                                  : "border-muted-foreground/30 hover:border-primary"
                              )}
                            >
                              {m.confirmed && <Check className="h-3 w-3" />}
                            </button>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate max-w-52">{m.transaction.description}</p>
                            <p className="text-xs text-muted-foreground">{m.transaction.date}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={cn("font-semibold text-sm", m.transaction.amount > 0 ? "text-emerald-700" : "text-red-700")}>
                            {m.transaction.amount > 0 ? "+" : ""}€ {Math.abs(m.transaction.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                          </span>
                        </TableCell>
                        <TableCell>
                          {m.matchedScadenza ? (
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground/30" />
                          )}
                        </TableCell>
                        <TableCell>
                          {m.matchedScadenza ? (
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate max-w-44">{m.matchedScadenza.soggetto_nome}</p>
                              <p className="text-xs text-muted-foreground">
                                {m.matchedScadenza.invoice_number || "N/D"} · Residuo: € {Number(m.matchedScadenza.importo_residuo).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Nessun match</span>
                          )}
                          {/* Possible alternatives */}
                          {m.status === "possible" && m.possibleMatches.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {m.possibleMatches.map(pm => (
                                <button
                                  key={pm.id}
                                  onClick={() => selectScadenza(m.transaction.id, pm)}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-primary/10 hover:text-primary transition-colors truncate max-w-32"
                                >
                                  {pm.soggetto_nome}
                                </button>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {m.status === "matched" && (
                            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 gap-0.5">
                              <CheckCircle className="h-2.5 w-2.5" />{m.confidence}%
                            </Badge>
                          )}
                          {m.status === "possible" && (
                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 gap-0.5">
                              <HelpCircle className="h-2.5 w-2.5" />{m.confidence}%
                            </Badge>
                          )}
                          {m.status === "unmatched" && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              <XCircle className="h-2.5 w-2.5 mr-0.5" />N/A
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={() => setStep("mapping")}>Indietro</Button>
                <div className="flex items-center gap-3">
                  {stats.confirmed > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {stats.confirmed} moviment{stats.confirmed === 1 ? "o" : "i"} · € {stats.totalAmount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                    </span>
                  )}
                  <Button onClick={handleConfirmAll} disabled={stats.confirmed === 0 || isConfirming}>
                    {isConfirming ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Registrazione...</> : <>Conferma {stats.confirmed} abbinament{stats.confirmed === 1 ? "o" : "i"}</>}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Done */}
          {step === "done" && (
            <div className="py-12 text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-emerald-100 mx-auto flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <p className="text-lg font-semibold">Riconciliazione completata!</p>
                <p className="text-muted-foreground text-sm mt-1">
                  {stats.confirmed} pagament{stats.confirmed === 1 ? "o registrato" : "i registrati"} per un totale di € {stats.totalAmount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <Button onClick={() => { resetState(); onOpenChange(false); }}>Chiudi</Button>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
