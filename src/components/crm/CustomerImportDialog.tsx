import { useState, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, ArrowRight, Check, RefreshCw, UserPlus, UserCheck, Brain } from "lucide-react";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";

interface CustomerImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCustomers: any[];
  onImportComplete: () => void;
}

interface ParsedRow {
  [key: string]: string;
}

interface MappedCustomer {
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  tax_id: string | null;
  pec: string | null;
  sdi_code: string | null;
  // Extra fields not in DB but useful to show
  _riferimento?: string;
  _cod_fiscale?: string;
  _cellulare?: string;
  _fax?: string;
  _web?: string;
  _nota?: string;
  _tipo?: string;
  _banca?: string;
  _iban?: string;
}

interface MatchResult {
  rowIndex: number;
  mapped: MappedCustomer;
  action: "insert" | "update" | "skip";
  matchedCustomer?: any;
  matchScore: number;
  matchReason?: string;
  selected: boolean;
}

// Keyword-based column detection: if the column contains any of these keywords, map to the field
// Order matters: more specific patterns first
const FIELD_DETECTION: Array<{ field: keyof MappedCustomer; keywords: string[]; excludeKeywords?: string[] }> = [
  { field: "tax_id", keywords: ["p.iva", "p. iva", "piva", "partita iva", "p.i."] },
  { field: "_cod_fiscale", keywords: ["cod. fiscale", "cod.fiscale", "codice fiscale", "c.f."], excludeKeywords: ["p.iva"] },
  { field: "sdi_code", keywords: ["destinatario", "sdi", "codice univoco"] },
  { field: "name", keywords: ["rag. sociale", "rag sociale", "ragione sociale", "denominazione", "intestazione"] },
  { field: "company_name", keywords: ["riferimento", "referente", "contatto"] },
  { field: "pec", keywords: ["pec"] },
  { field: "email", keywords: ["email", "e-mail", "mail"], excludeKeywords: ["pec"] },
  { field: "address", keywords: ["indirizzo", "via", "sede"] },
  { field: "city", keywords: ["città", "citta", "comune"] },
  { field: "province", keywords: ["provincia", "prov"] },
  { field: "postal_code", keywords: ["cap", "codice postale"] },
  { field: "country", keywords: ["paese", "nazione"] },
  { field: "phone", keywords: ["telefono", "tel"], excludeKeywords: ["cell"] },
  { field: "_cellulare", keywords: ["cellulare", "cell", "mobile"] },
  { field: "_fax", keywords: ["fax"] },
  { field: "_web", keywords: ["web", "sito"] },
  { field: "_nota", keywords: ["nota", "note"] },
  { field: "_tipo", keywords: ["tipo"] },
  { field: "_banca", keywords: ["banca"] },
  { field: "_iban", keywords: ["iban"] },
];

function detectColumnField(colName: string): keyof MappedCustomer | null {
  const lower = colName.toLowerCase().trim().replace(/\s+/g, " ");
  for (const { field, keywords, excludeKeywords } of FIELD_DETECTION) {
    if (excludeKeywords?.some(ek => lower.includes(ek))) continue;
    if (keywords.some(kw => lower.includes(kw))) return field;
  }
  return null;
}

function mapRow(row: ParsedRow, columns: string[]): MappedCustomer {
  const result: any = {
    name: "",
    company_name: null,
    email: null,
    phone: null,
    address: null,
    city: null,
    province: null,
    postal_code: null,
    country: null,
    tax_id: null,
    pec: null,
    sdi_code: null,
  };

  for (const col of columns) {
    const colLower = col.toLowerCase().trim();
    const field = COLUMN_MAP[colLower];
    if (field) {
      const val = String(row[col] || "").trim();
      if (val) {
        result[field] = val;
      }
    }
  }

  // If no tax_id but we have cod_fiscale, use that
  if (!result.tax_id && result._cod_fiscale) {
    result.tax_id = result._cod_fiscale;
  }

  // If no phone but we have cellulare, use that
  if (!result.phone && result._cellulare) {
    result.phone = result._cellulare;
  }

  return result;
}

function fuzzyMatch(a: string, b: string): number {
  if (!a || !b) return 0;
  const al = a.toLowerCase().trim().replace(/\s+(s\.?r\.?l\.?|s\.?p\.?a\.?|s\.?n\.?c\.?|ltd\.?|llc\.?|inc\.?)\.?$/i, "").trim();
  const bl = b.toLowerCase().trim().replace(/\s+(s\.?r\.?l\.?|s\.?p\.?a\.?|s\.?n\.?c\.?|ltd\.?|llc\.?|inc\.?)\.?$/i, "").trim();
  if (al === bl) return 100;
  if (al.includes(bl) || bl.includes(al)) return 85;
  const words1 = al.split(/\s+/);
  const words2 = bl.split(/\s+/);
  const common = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2))).length;
  const maxWords = Math.max(words1.length, words2.length);
  return maxWords > 0 ? Math.round((common / maxWords) * 75) : 0;
}

export function CustomerImportDialog({ open, onOpenChange, existingCustomers, onImportComplete }: CustomerImportDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rowCount, setRowCount] = useState(0);
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setFileName(file.name);
    setAnalyzing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: "" });

        if (json.length === 0) {
          toast({ title: "File vuoto", description: "Il file non contiene dati", variant: "destructive" });
          setAnalyzing(false);
          return;
        }

        const cols = Object.keys(json[0]);
        setRowCount(json.length);

        // Auto-map + match in one go
        const results: MatchResult[] = json.map((row, idx) => {
          const mapped = mapRow(row, cols);

          let bestMatch: any = null;
          let bestScore = 0;
          let bestReason = "";

          for (const cust of existingCustomers) {
            let score = 0;
            let reason = "";

            // Exact tax_id match
            if (mapped.tax_id && cust.tax_id) {
              const a = mapped.tax_id.replace(/\s/g, "").toUpperCase();
              const b = cust.tax_id.replace(/\s/g, "").toUpperCase();
              if (a === b) {
                score = 95;
                reason = "P.IVA corrispondente";
              }
            }

            // Exact email match
            if (score < 90 && mapped.email && cust.email) {
              if (mapped.email.toLowerCase() === cust.email.toLowerCase()) {
                score = Math.max(score, 90);
                reason = reason || "Email corrispondente";
              }
            }

            // Name fuzzy
            if (mapped.name) {
              const nameScore = fuzzyMatch(mapped.name, cust.name || "");
              if (nameScore > score) {
                score = nameScore;
                reason = `Nome simile (${nameScore}%)`;
              }
            }

            if (score > bestScore) {
              bestScore = score;
              bestMatch = cust;
              bestReason = reason;
            }
          }

          const action: "insert" | "update" | "skip" = bestScore >= 70 ? "update" : "insert";

          return {
            rowIndex: idx,
            mapped,
            action,
            matchedCustomer: bestScore >= 70 ? bestMatch : undefined,
            matchScore: bestScore,
            matchReason: bestReason,
            selected: !!mapped.name, // skip rows without a name
          };
        });

        setMatchResults(results);
        setAnalyzing(false);
        setStep(2);
      } catch {
        toast({ title: "Errore", description: "Impossibile leggere il file", variant: "destructive" });
        setAnalyzing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }, [existingCustomers]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    maxFiles: 1,
  });

  const toggleResult = (idx: number) => {
    setMatchResults(prev => prev.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r));
  };

  const changeAction = (idx: number, action: "insert" | "update" | "skip") => {
    setMatchResults(prev => prev.map((r, i) => i === idx ? { ...r, action } : r));
  };

  const executeImport = async () => {
    setProcessing(true);
    const selected = matchResults.filter(r => r.selected && r.action !== "skip");
    let inserted = 0, updated = 0, errors = 0;

    for (const result of selected) {
      const m = result.mapped;
      const customerData: any = {};

      if (m.name) customerData.name = m.name;
      if (m.company_name) customerData.company_name = m.company_name;
      if (m.email) customerData.email = m.email;
      if (m.phone) customerData.phone = m.phone;
      if (m.address) customerData.address = m.address;
      if (m.city) customerData.city = m.city;
      if (m.province) customerData.province = m.province;
      if (m.postal_code) customerData.postal_code = m.postal_code;
      if (m.country) customerData.country = m.country;
      if (m.tax_id) customerData.tax_id = m.tax_id;
      if (m.pec) customerData.pec = m.pec;
      if (m.sdi_code) customerData.sdi_code = m.sdi_code;

      try {
        if (result.action === "update" && result.matchedCustomer) {
          const updateData: any = {};
          for (const [key, val] of Object.entries(customerData)) {
            if (val !== null && val !== undefined && val !== "") {
              updateData[key] = val;
            }
          }
          if (Object.keys(updateData).length > 0) {
            const { error } = await supabase
              .from("customers")
              .update(updateData)
              .eq("id", result.matchedCustomer.id);
            if (error) throw error;
            updated++;
          }
        } else if (result.action === "insert") {
          if (!customerData.name) { errors++; continue; }
          customerData.active = true;
          const { error } = await supabase.from("customers").insert(customerData);
          if (error) throw error;
          inserted++;
        }
      } catch (err: any) {
        console.error("Import error:", err);
        errors++;
      }
    }

    setProcessing(false);
    setStep(3);
    toast({
      title: "Import completato",
      description: `${inserted} inseriti, ${updated} aggiornati${errors > 0 ? `, ${errors} errori` : ""}`,
    });
  };

  const resetDialog = () => {
    setStep(1);
    setMatchResults([]);
    setFileName("");
    setRowCount(0);
    setAnalyzing(false);
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      if (step === 3) onImportComplete();
      resetDialog();
    }
    onOpenChange(isOpen);
  };

  const summaryStats = useMemo(() => {
    const sel = matchResults.filter(r => r.selected);
    return {
      total: matchResults.length,
      selected: sel.length,
      inserts: sel.filter(r => r.action === "insert").length,
      updates: sel.filter(r => r.action === "update").length,
      skips: sel.filter(r => r.action === "skip").length,
    };
  }, [matchResults]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Import Clienti da Excel — Step {step}/3
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          {[
            { n: 1, label: "Carica File" },
            { n: 2, label: "Verifica AI" },
            { n: 3, label: "Completato" },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                step >= s.n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {step > s.n ? <Check className="w-3 h-3" /> : s.n}
              </div>
              <span className={step === s.n ? "font-medium text-foreground" : ""}>{s.label}</span>
              {i < 2 && <ArrowRight className="w-3 h-3 mx-1" />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {/* STEP 1: Upload */}
          {step === 1 && !analyzing && (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-16 text-center cursor-pointer transition-colors ${
                isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">Trascina qui il file Excel o CSV</p>
              <p className="text-sm text-muted-foreground mt-2">
                Supportati: .xlsx, .xls, .csv — Le colonne vengono riconosciute automaticamente
              </p>
            </div>
          )}

          {/* Analyzing spinner */}
          {step === 1 && analyzing && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="relative">
                <Brain className="w-12 h-12 text-primary animate-pulse" />
              </div>
              <p className="text-lg font-medium">Analisi AI in corso...</p>
              <p className="text-sm text-muted-foreground">
                Riconoscimento colonne e matching con {existingCustomers.length} clienti esistenti
              </p>
            </div>
          )}

          {/* STEP 2: Match review */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-3 text-sm flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary shrink-0" />
                <span>
                  <strong>{fileName}</strong> — {rowCount} righe analizzate automaticamente.
                  Verifica le azioni proposte e conferma l'import.
                </span>
              </div>

              <div className="flex gap-3">
                <Badge variant="outline" className="px-3 py-1">
                  <UserPlus className="w-3 h-3 mr-1" />
                  Nuovi: {summaryStats.inserts}
                </Badge>
                <Badge variant="outline" className="px-3 py-1">
                  <UserCheck className="w-3 h-3 mr-1" />
                  Aggiornamenti: {summaryStats.updates}
                </Badge>
                <Badge variant="secondary" className="px-3 py-1">
                  Saltati: {summaryStats.skips}
                </Badge>
              </div>

              <ScrollArea className="h-[400px] border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="min-w-[200px]">Rag. Sociale</TableHead>
                      <TableHead className="min-w-[130px]">P.IVA / CF</TableHead>
                      <TableHead className="min-w-[150px]">Email</TableHead>
                      <TableHead className="min-w-[120px]">Telefono</TableHead>
                      <TableHead className="min-w-[120px]">Città</TableHead>
                      <TableHead className="min-w-[130px]">Azione</TableHead>
                      <TableHead className="min-w-[160px]">Match con</TableHead>
                      <TableHead className="w-16">Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matchResults.map((result, idx) => (
                      <TableRow key={idx} className={!result.selected ? "opacity-40" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={result.selected}
                            onCheckedChange={() => toggleResult(idx)}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-sm">{result.mapped.name || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{result.mapped.tax_id || result.mapped._cod_fiscale || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{result.mapped.email || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{result.mapped.phone || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{result.mapped.city || "—"}</TableCell>
                        <TableCell>
                          <Select
                            value={result.action}
                            onValueChange={(val) => changeAction(idx, val as any)}
                          >
                            <SelectTrigger className="h-7 text-xs w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="insert">
                                <span className="flex items-center gap-1"><UserPlus className="w-3 h-3" /> Inserisci</span>
                              </SelectItem>
                              <SelectItem value="update">
                                <span className="flex items-center gap-1"><UserCheck className="w-3 h-3" /> Aggiorna</span>
                              </SelectItem>
                              <SelectItem value="skip">Salta</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-xs">
                          {result.matchedCustomer ? (
                            <span className="text-muted-foreground">{result.matchedCustomer.name}</span>
                          ) : (
                            <span className="text-muted-foreground italic">Nessuno</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {result.matchScore > 0 && (
                            <Badge variant={result.matchScore >= 90 ? "default" : result.matchScore >= 70 ? "secondary" : "outline"} className="text-xs">
                              {result.matchScore}%
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => { resetDialog(); }}>Ricomincia</Button>
                <Button onClick={executeImport} disabled={processing || summaryStats.selected === 0}>
                  {processing ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Importazione...</>
                  ) : (
                    <>Conferma Import ({summaryStats.inserts} nuovi, {summaryStats.updates} aggiornamenti)</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Done */}
          {step === 3 && (
            <div className="text-center py-16 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold">Import Completato</h3>
              <p className="text-muted-foreground">
                I clienti sono stati importati e aggiornati con successo.
              </p>
              <Button onClick={() => handleClose(false)}>Chiudi</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
