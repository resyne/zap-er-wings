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
import { Upload, FileSpreadsheet, ArrowRight, Check, AlertTriangle, RefreshCw, UserPlus, UserCheck } from "lucide-react";
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

interface ColumnMapping {
  name: string | null;
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
  payment_terms: string | null;
  credit_limit: string | null;
  shipping_address: string | null;
}

interface MatchResult {
  rowIndex: number;
  parsedData: Record<string, string>;
  action: "insert" | "update" | "skip";
  matchedCustomer?: any;
  matchScore: number;
  matchReason?: string;
  selected: boolean;
}

const FIELD_LABELS: Record<keyof ColumnMapping, string> = {
  name: "Nome / Ragione Sociale",
  company_name: "Nome Azienda",
  email: "Email",
  phone: "Telefono",
  address: "Indirizzo",
  city: "Città",
  province: "Provincia",
  postal_code: "CAP",
  country: "Paese",
  tax_id: "P.IVA / CF",
  pec: "PEC",
  sdi_code: "Codice SDI",
  payment_terms: "Termini Pagamento (gg)",
  credit_limit: "Limite Credito",
  shipping_address: "Indirizzo Spedizione",
};

const FIELD_KEYWORDS: Record<keyof ColumnMapping, string[]> = {
  name: ["nome", "ragione", "sociale", "denominazione", "intestazione", "name", "cliente", "customer"],
  company_name: ["azienda", "company", "società", "ditta", "impresa"],
  email: ["email", "mail", "e-mail", "posta"],
  phone: ["telefono", "tel", "phone", "cellulare", "mobile"],
  address: ["indirizzo", "via", "address", "sede"],
  city: ["città", "city", "comune", "localita"],
  province: ["provincia", "prov", "province"],
  postal_code: ["cap", "zip", "postal", "codice postale"],
  country: ["paese", "country", "nazione", "stato"],
  tax_id: ["piva", "p.iva", "partita iva", "codice fiscale", "cf", "tax", "vat"],
  pec: ["pec"],
  sdi_code: ["sdi", "codice destinatario", "codice univoco"],
  payment_terms: ["pagamento", "payment", "termini", "scadenza"],
  credit_limit: ["credito", "credit", "limite", "fido"],
  shipping_address: ["spedizione", "shipping", "consegna", "delivery"],
};

export function CustomerImportDialog({ open, onOpenChange, existingCustomers, onImportComplete }: CustomerImportDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    name: null, company_name: null, email: null, phone: null,
    address: null, city: null, province: null, postal_code: null,
    country: null, tax_id: null, pec: null, sdi_code: null,
    payment_terms: null, credit_limit: null, shipping_address: null,
  });
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [fileName, setFileName] = useState("");
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: "" });

        if (json.length === 0) {
          toast({ title: "File vuoto", description: "Il file non contiene dati", variant: "destructive" });
          return;
        }

        const cols = Object.keys(json[0]);
        setColumns(cols);
        setParsedRows(json);
        autoMapColumns(cols);
        setStep(2);
      } catch {
        toast({ title: "Errore", description: "Impossibile leggere il file", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    maxFiles: 1,
  });

  const autoMapColumns = (cols: string[]) => {
    const newMapping: any = { ...mapping };
    for (const [field, keywords] of Object.entries(FIELD_KEYWORDS)) {
      for (const col of cols) {
        const colLower = col.toLowerCase().trim();
        if (keywords.some(kw => colLower.includes(kw))) {
          if (!Object.values(newMapping).includes(col)) {
            newMapping[field] = col;
            break;
          }
        }
      }
    }
    setMapping(newMapping);
  };

  const fuzzyMatch = (a: string, b: string): number => {
    if (!a || !b) return 0;
    const al = a.toLowerCase().trim();
    const bl = b.toLowerCase().trim();
    if (al === bl) return 100;
    if (al.includes(bl) || bl.includes(al)) return 80;
    const words1 = al.split(/\s+/);
    const words2 = bl.split(/\s+/);
    const common = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2))).length;
    const maxWords = Math.max(words1.length, words2.length);
    return maxWords > 0 ? Math.round((common / maxWords) * 70) : 0;
  };

  const runMatching = () => {
    const results: MatchResult[] = parsedRows.map((row, idx) => {
      const rowName = mapping.name ? String(row[mapping.name] || "").trim() : "";
      const rowEmail = mapping.email ? String(row[mapping.email] || "").trim().toLowerCase() : "";
      const rowTaxId = mapping.tax_id ? String(row[mapping.tax_id] || "").trim().toUpperCase() : "";
      const rowCompany = mapping.company_name ? String(row[mapping.company_name] || "").trim() : "";

      let bestMatch: any = null;
      let bestScore = 0;
      let bestReason = "";

      for (const cust of existingCustomers) {
        let score = 0;
        let reason = "";

        // Exact tax_id match = strong
        if (rowTaxId && cust.tax_id && rowTaxId === cust.tax_id.trim().toUpperCase()) {
          score = Math.max(score, 95);
          reason = "P.IVA corrispondente";
        }

        // Exact email match
        if (rowEmail && cust.email && rowEmail === cust.email.trim().toLowerCase()) {
          score = Math.max(score, 90);
          reason = reason || "Email corrispondente";
        }

        // Name fuzzy
        if (rowName) {
          const nameScore = fuzzyMatch(rowName, cust.name || "");
          if (nameScore > score) {
            score = nameScore;
            reason = `Nome simile (${nameScore}%)`;
          }
        }

        // Company name fuzzy
        if (rowCompany && cust.company_name) {
          const compScore = fuzzyMatch(rowCompany, cust.company_name);
          if (compScore > score) {
            score = compScore;
            reason = `Azienda simile (${compScore}%)`;
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
        parsedData: row,
        action,
        matchedCustomer: bestScore >= 70 ? bestMatch : undefined,
        matchScore: bestScore,
        matchReason: bestReason,
        selected: true,
      };
    });

    setMatchResults(results);
    setStep(3);
  };

  const toggleResult = (idx: number) => {
    setMatchResults(prev => prev.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r));
  };

  const changeAction = (idx: number, action: "insert" | "update" | "skip") => {
    setMatchResults(prev => prev.map((r, i) => i === idx ? { ...r, action } : r));
  };

  const getMappedValue = (row: ParsedRow, field: keyof ColumnMapping): string | null => {
    const col = mapping[field];
    if (!col) return null;
    const val = String(row[col] || "").trim();
    return val || null;
  };

  const executeImport = async () => {
    setProcessing(true);
    const selected = matchResults.filter(r => r.selected && r.action !== "skip");
    let inserted = 0, updated = 0, errors = 0;

    for (const result of selected) {
      const row = result.parsedData;
      const customerData: any = {};

      // Map all fields
      const name = getMappedValue(row, "name");
      if (name) customerData.name = name;
      const company_name = getMappedValue(row, "company_name");
      if (company_name) customerData.company_name = company_name;
      const email = getMappedValue(row, "email");
      if (email) customerData.email = email;
      const phone = getMappedValue(row, "phone");
      if (phone) customerData.phone = phone;
      const address = getMappedValue(row, "address");
      if (address) customerData.address = address;
      const city = getMappedValue(row, "city");
      if (city) customerData.city = city;
      const province = getMappedValue(row, "province");
      if (province) customerData.province = province;
      const postal_code = getMappedValue(row, "postal_code");
      if (postal_code) customerData.postal_code = postal_code;
      const country = getMappedValue(row, "country");
      if (country) customerData.country = country;
      const tax_id = getMappedValue(row, "tax_id");
      if (tax_id) customerData.tax_id = tax_id;
      const pec = getMappedValue(row, "pec");
      if (pec) customerData.pec = pec;
      const sdi_code = getMappedValue(row, "sdi_code");
      if (sdi_code) customerData.sdi_code = sdi_code;
      const shipping_address = getMappedValue(row, "shipping_address");
      if (shipping_address) customerData.shipping_address = shipping_address;
      const payment_terms = getMappedValue(row, "payment_terms");
      if (payment_terms) {
        const pt = parseInt(payment_terms);
        if (!isNaN(pt)) customerData.payment_terms = pt;
      }
      const credit_limit = getMappedValue(row, "credit_limit");
      if (credit_limit) {
        const cl = parseFloat(credit_limit.replace(/[^\d.,]/g, "").replace(",", "."));
        if (!isNaN(cl)) customerData.credit_limit = cl;
      }

      try {
        if (result.action === "update" && result.matchedCustomer) {
          // Only update non-empty fields
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
          if (!customerData.name) {
            errors++;
            continue;
          }
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
    setStep(4);
    toast({
      title: "Import completato",
      description: `${inserted} inseriti, ${updated} aggiornati${errors > 0 ? `, ${errors} errori` : ""}`,
    });
  };

  const resetDialog = () => {
    setStep(1);
    setParsedRows([]);
    setColumns([]);
    setMatchResults([]);
    setFileName("");
    setMapping({
      name: null, company_name: null, email: null, phone: null,
      address: null, city: null, province: null, postal_code: null,
      country: null, tax_id: null, pec: null, sdi_code: null,
      payment_terms: null, credit_limit: null, shipping_address: null,
    });
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      if (step === 4) onImportComplete();
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
            Import Clienti da Excel — Step {step}/4
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          {[
            { n: 1, label: "Carica File" },
            { n: 2, label: "Mappa Colonne" },
            { n: 3, label: "Verifica Match" },
            { n: 4, label: "Completato" },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                step >= s.n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {step > s.n ? <Check className="w-3 h-3" /> : s.n}
              </div>
              <span className={step === s.n ? "font-medium text-foreground" : ""}>{s.label}</span>
              {i < 3 && <ArrowRight className="w-3 h-3 mx-1" />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {/* STEP 1: Upload */}
          {step === 1 && (
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
                Supportati: .xlsx, .xls, .csv
              </p>
            </div>
          )}

          {/* STEP 2: Column mapping */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <span className="font-medium">{fileName}</span> — {parsedRows.length} righe, {columns.length} colonne.
                Associa le colonne del file ai campi del cliente.
              </div>

              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(FIELD_LABELS) as Array<keyof ColumnMapping>).map(field => (
                  <div key={field} className="flex items-center gap-2">
                    <label className="text-sm font-medium w-44 shrink-0">{FIELD_LABELS[field]}</label>
                    <Select
                      value={mapping[field] || "__none__"}
                      onValueChange={(val) => setMapping(prev => ({ ...prev, [field]: val === "__none__" ? null : val }))}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="— Non mappato —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Non mappato —</SelectItem>
                        {columns.map(col => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {/* Preview */}
              <div className="text-sm font-medium mt-4">Anteprima prime 3 righe:</div>
              <ScrollArea className="h-40 border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.slice(0, 8).map(col => (
                        <TableHead key={col} className="text-xs whitespace-nowrap">{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.slice(0, 3).map((row, i) => (
                      <TableRow key={i}>
                        {columns.slice(0, 8).map(col => (
                          <TableCell key={col} className="text-xs">{String(row[col] || "")}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>Indietro</Button>
                <Button onClick={runMatching} disabled={!mapping.name}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Analizza e Abbina ({parsedRows.length} righe)
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Match review */}
          {step === 3 && (
            <div className="space-y-3">
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
                      <TableHead>Nome dal file</TableHead>
                      <TableHead>P.IVA</TableHead>
                      <TableHead>Azione</TableHead>
                      <TableHead>Match</TableHead>
                      <TableHead>Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matchResults.map((result, idx) => {
                      const rowName = mapping.name ? String(result.parsedData[mapping.name] || "") : "";
                      const rowTaxId = mapping.tax_id ? String(result.parsedData[mapping.tax_id] || "") : "";
                      return (
                        <TableRow key={idx} className={!result.selected ? "opacity-40" : ""}>
                          <TableCell>
                            <Checkbox
                              checked={result.selected}
                              onCheckedChange={() => toggleResult(idx)}
                            />
                          </TableCell>
                          <TableCell className="font-medium text-sm">{rowName}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{rowTaxId}</TableCell>
                          <TableCell>
                            <Select
                              value={result.action}
                              onValueChange={(val) => changeAction(idx, val as any)}
                            >
                              <SelectTrigger className="h-7 text-xs w-32">
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
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>Indietro</Button>
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

          {/* STEP 4: Done */}
          {step === 4 && (
            <div className="text-center py-16 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
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
