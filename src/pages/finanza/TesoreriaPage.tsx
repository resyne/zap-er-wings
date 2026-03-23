import { useState, useCallback, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import {
  Upload, Search, Check, Link2, Plus, EyeOff, RefreshCw, FileSpreadsheet,
  ArrowDownCircle, ArrowUpCircle, Lock, ShieldCheck, BookOpen, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type MovementStatus = "unmatched" | "suggested" | "matched" | "partial" | "ignored";
type Direction = "inflow" | "outflow";

const statusConfig: Record<MovementStatus, { label: string; color: string }> = {
  unmatched: { label: "Da riconciliare", color: "bg-amber-100 text-amber-800" },
  suggested: { label: "Match suggerito", color: "bg-blue-100 text-blue-800" },
  matched: { label: "Riconciliato", color: "bg-emerald-100 text-emerald-800" },
  partial: { label: "Parziale", color: "bg-orange-100 text-orange-800" },
  ignored: { label: "Ignorato", color: "bg-gray-100 text-gray-600" },
};

const PAGAMENTI_ACCESS_CODE = "33";

function PagamentiGate({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === PAGAMENTI_ACCESS_CODE) {
      onUnlock();
      setError(false);
    } else {
      setError(true);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6 space-y-4">
          <div className="text-center space-y-2">
            <div className="mx-auto h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
              <Lock className="h-7 w-7 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold">Sezione Protetta</h2>
            <p className="text-sm text-muted-foreground">
              Inserisci la password per accedere alla sezione Pagamenti
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="password"
              placeholder="Password di accesso"
              value={code}
              onChange={(e) => { setCode(e.target.value); setError(false); }}
              className={error ? "border-destructive" : ""}
              autoFocus
            />
            {error && (
              <p className="text-xs text-destructive">Password errata. Riprova.</p>
            )}
            <Button type="submit" className="w-full gap-2">
              <ShieldCheck className="h-4 w-4" />
              Accedi
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TesoreriaPage() {
  const [activeTab, setActiveTab] = useState<"incassi" | "pagamenti">("incassi");
  const [pagamentiUnlocked, setPagamentiUnlocked] = useState(false);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Tesoreria</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Riconciliazione movimenti bancari con fatture e documenti contabili
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="incassi" className="gap-2">
            <ArrowDownCircle className="h-4 w-4" />
            Incassi
          </TabsTrigger>
          <TabsTrigger value="pagamenti" className="gap-2">
            <ArrowUpCircle className="h-4 w-4" />
            Pagamenti
            {!pagamentiUnlocked && <Lock className="h-3 w-3 ml-1 text-muted-foreground" />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="incassi">
          <ReconciliationPanel direction="inflow" />
        </TabsContent>
        <TabsContent value="pagamenti">
          {pagamentiUnlocked ? (
            <ReconciliationPanel direction="outflow" />
          ) : (
            <PagamentiGate onUnlock={() => setPagamentiUnlocked(true)} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface AiMovement {
  data_movimento: string;
  data_valuta?: string;
  descrizione: string;
  importo: number;
  tipo: "entrata" | "uscita";
  riferimento?: string;
  direction: string;
  relevant: boolean;
  selected?: boolean;
}

function ReconciliationPanel({ direction }: { direction: Direction }) {
  const isInflow = direction === "inflow";
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<any>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isAutoMatching, setIsAutoMatching] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // AI import states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiPreviewOpen, setAiPreviewOpen] = useState(false);
  const [aiMovements, setAiMovements] = useState<AiMovement[]>([]);
  const [aiBankInfo, setAiBankInfo] = useState<{ bank_name?: string; account_iban?: string; period?: string } | null>(null);

  const queryKey = [`bank-movements-${direction}`];

  const { data: movements = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_movements")
        .select("*, bank_reconciliations(*)")
        .eq("direction", direction)
        .order("movement_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const invoiceTypes = isInflow
    ? ["vendita", "nota_credito_vendita"]
    : ["acquisto", "nota_credito_acquisto"];
  const invoiceStatuses = isInflow
    ? ["da_incassare", "parzialmente_incassata"]
    : ["da_pagare", "parzialmente_pagata"];

  const { data: openInvoices = [] } = useQuery({
    queryKey: [`open-invoices-${direction}`],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_registry")
        .select("*")
        .in("invoice_type", invoiceTypes)
        .in("financial_status", invoiceStatuses)
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // --- AI-powered file import ---
  const processFileAI = useCallback(async (file: File) => {
    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("direction", direction);
      formData.append("userId", user?.id || "");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-bank-statement`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Errore sconosciuto" }));
        throw new Error(errData.error || `Errore ${response.status}`);
      }

      const result = await response.json();

      if (!result.movements || result.movements.length === 0) {
        toast.error("Nessun movimento trovato nel documento");
        return;
      }

      // Mark all relevant movements as selected by default
      const movementsWithSelection = result.movements.map((m: AiMovement) => ({
        ...m,
        selected: m.relevant,
      }));

      setAiMovements(movementsWithSelection);
      setAiBankInfo({
        bank_name: result.bank_name,
        account_iban: result.account_iban,
        period: result.period,
      });
      setAiPreviewOpen(true);
      toast.success(`AI ha estratto ${result.total_movements} movimenti dal documento`);
    } catch (err: any) {
      toast.error("Errore analisi AI: " + err.message);
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [user, direction]);

  // Legacy XLSX import (for inflow or fallback)
  const processFileXLSX = useCallback(async (file: File) => {
    setIsImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { raw: false });

      if (rows.length === 0) { toast.error("Il file non contiene dati"); return; }

      const sampleKeys = Object.keys(rows[0] || {});
      const findCol = (patterns: string[]) =>
        sampleKeys.find(k => patterns.some(p => k.toLowerCase().includes(p)));

      const amountCol = findCol(["importo", "amount", "dare", "avere", "totale", "saldo", "valuta"]);
      const dateCol = findCol(["data", "date", "valuta", "operazione"]);
      const descCol = findCol(["descrizione", "description", "causale", "motivo", "oggetto", "riferimento"]);
      const ibanCol = findCol(["iban"]);
      const refCol = findCol(["riferimento", "reference", "cro", "trn"]);
      const accountCol = findCol(["conto", "account", "corrente"]);

      if (!amountCol) {
        toast.error(`Colonna importo non trovata. Colonne: ${sampleKeys.join(", ")}`);
        return;
      }

      const batchId = crypto.randomUUID();
      const items = rows.map((row) => {
        let rawAmount = row[amountCol!] || "0";
        let amount = parseFloat(String(rawAmount).replace(/[€\s.]/g, "").replace(",", "."));
        if (isNaN(amount)) amount = parseFloat(String(rawAmount).replace(/[€\s]/g, "").replace(",", "."));
        if (isNaN(amount)) return null;
        amount = Math.abs(amount);
        if (amount === 0) return null;

        const dateStr = dateCol ? (row[dateCol] || "") : "";
        let movDate: string;
        try {
          const parts = String(dateStr).split("/");
          let d: Date;
          if (parts.length === 3 && parts[0].length <= 2) {
            d = new Date(`${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`);
          } else {
            d = new Date(dateStr);
          }
          movDate = isNaN(d.getTime()) ? new Date().toISOString().split("T")[0] : d.toISOString().split("T")[0];
        } catch { movDate = new Date().toISOString().split("T")[0]; }

        return {
          import_batch_id: batchId,
          movement_date: movDate,
          description: descCol ? (row[descCol] || "") : "",
          amount,
          direction,
          bank_account: accountCol ? (row[accountCol] || null) : null,
          iban: ibanCol ? (row[ibanCol] || null) : null,
          reference: refCol ? (row[refCol] || null) : null,
          raw_data: row,
          status: "unmatched" as const,
          imported_by: user?.id,
        };
      }).filter(Boolean);

      if (items.length === 0) {
        toast.error("Nessun movimento trovato nel file");
        return;
      }

      const { error } = await supabase.from("bank_movements").insert(items as any);
      if (error) throw error;

      toast.success(`${items.length} movimenti importati con successo`);
      queryClient.invalidateQueries({ queryKey });
    } catch (err: any) {
      toast.error("Errore import: " + err.message);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [user, queryClient, direction, queryKey]);

  // Always use AI import for all file types
  const processFile = useCallback((file: File) => {
    processFileAI(file);
  }, [processFileAI]);

  // Confirm AI import - insert selected movements into DB
  const confirmAiImport = useCallback(async () => {
    const selected = aiMovements.filter(m => m.selected);
    if (selected.length === 0) {
      toast.error("Seleziona almeno un movimento da importare");
      return;
    }

    setIsImporting(true);
    try {
      const batchId = crypto.randomUUID();
      const items = selected.map(m => ({
        import_batch_id: batchId,
        movement_date: m.data_movimento,
        value_date: m.data_valuta || null,
        description: m.descrizione,
        amount: m.importo,
        direction: m.direction || direction,
        bank_account: aiBankInfo?.account_iban || null,
        iban: aiBankInfo?.account_iban || null,
        reference: m.riferimento || null,
        raw_data: m,
        status: "unmatched" as const,
        imported_by: user?.id,
      }));

      const { error } = await supabase.from("bank_movements").insert(items as any);
      if (error) throw error;

      toast.success(`${items.length} movimenti importati con successo`);
      setAiPreviewOpen(false);
      setAiMovements([]);
      queryClient.invalidateQueries({ queryKey });
    } catch (err: any) {
      toast.error("Errore import: " + err.message);
    } finally {
      setIsImporting(false);
    }
  }, [aiMovements, aiBankInfo, direction, user, queryClient, queryKey]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    } else {
      toast.error("File non valido");
    }
  }, [processFile]);

  // Automatch
  const runAutomatch = useCallback(async () => {
    setIsAutoMatching(true);
    try {
      const unmatched = movements.filter((m: any) => m.status === "unmatched");
      let matchCount = 0;

      for (const mov of unmatched) {
        let bestMatch: any = null;
        let bestScore = 0;

        for (const inv of openInvoices) {
          let score = 0;
          if (Math.abs(inv.total_amount - mov.amount) < 0.01) score += 50;
          else if (Math.abs(inv.total_amount - mov.amount) < inv.total_amount * 0.05) score += 20;

          const desc = (mov.description || "").toLowerCase();
          const subj = (inv.subject_name || "").toLowerCase();
          if (subj && desc.includes(subj)) score += 30;
          else if (subj) {
            const words = subj.split(/\s+/).filter((w: string) => w.length > 3);
            const matched = words.filter((w: string) => desc.includes(w));
            if (matched.length > 0) score += (matched.length / words.length) * 20;
          }

          const invNum = (inv.invoice_number || "").toLowerCase();
          if (invNum && desc.includes(invNum)) score += 20;

          if (score > bestScore) { bestScore = score; bestMatch = inv; }
        }

        if (bestMatch && bestScore >= 50) {
          await supabase.from("bank_movements").update({
            status: "suggested",
            matched_subject_name: bestMatch.subject_name,
            matched_subject_id: bestMatch.subject_id,
          }).eq("id", mov.id);

          await supabase.from("bank_reconciliations").insert({
            bank_movement_id: mov.id,
            invoice_id: bestMatch.id,
            reconciled_amount: mov.amount,
            match_type: bestScore >= 70 ? "auto" : "suggested",
            match_score: bestScore,
            reconciled_by: user?.id,
            notes: `Match: ${bestMatch.invoice_number} - ${bestMatch.subject_name} - €${bestMatch.total_amount?.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`,
          });
          matchCount++;
        }
      }

      toast.success(`Automatch completato: ${matchCount} match trovati su ${unmatched.length} movimenti`);
      queryClient.invalidateQueries({ queryKey });
    } catch (err: any) {
      toast.error("Errore automatch: " + err.message);
    } finally {
      setIsAutoMatching(false);
    }
  }, [movements, openInvoices, user, queryClient, queryKey]);

  // Helper: find the invoice linked to a reconciliation
  const getLinkedInvoice = useCallback((recon: any) => {
    if (!recon?.invoice_id) return null;
    return openInvoices.find((inv: any) => inv.id === recon.invoice_id) || null;
  }, [openInvoices]);

  // Helper: create prima nota + lines for a reconciliation payment
  const createPrimaNotaForReconciliation = async (
    movementId: string, 
    invoiceId: string, 
    amount: number, 
    movementDate: string,
    isCredit: boolean
  ) => {
    // Create accounting entry
    const { data: ae, error: aeErr } = await supabase.from("accounting_entries").insert({
      document_date: movementDate,
      document_type: "documento_interno",
      direction: isCredit ? "entrata" : "uscita",
      amount,
      totale: amount,
      status: "registrato",
      financial_status: isCredit ? "incassato" : "pagato",
      payment_method: "bonifico",
      payment_date: movementDate,
      affects_income_statement: false,
      note: `Riconciliazione bancaria - ${isCredit ? "Incasso" : "Pagamento"}`,
      attachment_url: "",
    }).select().single();
    if (aeErr) throw aeErr;

    // Create prima nota
    const { data: pn, error: pnErr } = await supabase.from("prima_nota").insert({
      accounting_entry_id: ae.id,
      movement_type: "finanziario",
      competence_date: movementDate,
      amount,
      description: `Riconciliazione bancaria - ${isCredit ? "Incasso" : "Pagamento"}`,
      status: "registrato",
      payment_method: "bonifico",
    }).select().single();
    if (pnErr) throw pnErr;

    // Create double-entry lines
    const lines = isCredit
      ? [
          { prima_nota_id: pn.id, line_order: 1, account_type: "dynamic", dynamic_account_key: "BANCA", chart_account_id: null, dare: amount, avere: 0, description: "Incasso da cliente (bonifico)" },
          { prima_nota_id: pn.id, line_order: 2, account_type: "dynamic", dynamic_account_key: "CREDITI_CLIENTI", chart_account_id: null, dare: 0, avere: amount, description: "Chiusura credito vs clienti" },
        ]
      : [
          { prima_nota_id: pn.id, line_order: 1, account_type: "dynamic", dynamic_account_key: "DEBITI_FORNITORI", chart_account_id: null, dare: amount, avere: 0, description: "Chiusura debito vs fornitori" },
          { prima_nota_id: pn.id, line_order: 2, account_type: "dynamic", dynamic_account_key: "BANCA", chart_account_id: null, dare: 0, avere: amount, description: "Pagamento a fornitore (bonifico)" },
        ];
    
    const { error: lErr } = await supabase.from("prima_nota_lines").insert(lines);
    if (lErr) throw lErr;

    // Update bank_reconciliation with prima_nota_id
    await supabase.from("bank_reconciliations")
      .update({ prima_nota_id: pn.id })
      .eq("bank_movement_id", movementId)
      .eq("invoice_id", invoiceId);

    return pn.id;
  };

  // Register prima nota for a matched movement that's missing it
  const registerPrimaNotaForMovement = async (movementId: string) => {
    try {
      const mov = movements.find((m: any) => m.id === movementId);
      if (!mov) return;
      const { data: recons } = await supabase
        .from("bank_reconciliations")
        .select("id, invoice_id, reconciled_amount, prima_nota_id")
        .eq("bank_movement_id", movementId);
      if (!recons || recons.length === 0) {
        toast.error("Nessuna riconciliazione trovata per questo movimento");
        return;
      }
      let created = 0;
      for (const rec of recons) {
        if (!rec.prima_nota_id && rec.invoice_id) {
          const movDate = mov.movement_date || new Date().toISOString().split("T")[0];
          await createPrimaNotaForReconciliation(movementId, rec.invoice_id, rec.reconciled_amount, movDate, isInflow);
          created++;
        }
      }
      if (created > 0) {
        toast.success(`Prima Nota registrata per ${created} riconciliazione/i`);
        queryClient.invalidateQueries({ queryKey });
        queryClient.invalidateQueries({ queryKey: ["prima-nota"] });
      } else {
        toast.info("Prima Nota già presente per tutte le riconciliazioni");
      }
    } catch (err: any) {
      toast.error("Errore: " + err.message);
    }
  };

  // Confirm match
  const confirmMatch = async (movementId: string) => {
    try {
      const mov = movements.find((m: any) => m.id === movementId);
      await supabase.from("bank_movements").update({ status: "matched" }).eq("id", movementId);
      const { data: recons } = await supabase
        .from("bank_reconciliations")
        .select("invoice_id, reconciled_amount, scadenza_id, prima_nota_id")
        .eq("bank_movement_id", movementId);

      if (recons) {
        for (const rec of recons) {
          // Create prima nota if not already created
          if (!rec.prima_nota_id && rec.invoice_id) {
            const movDate = mov?.movement_date || new Date().toISOString().split("T")[0];
            await createPrimaNotaForReconciliation(movementId, rec.invoice_id, rec.reconciled_amount, movDate, isInflow);
          }

          if (rec.invoice_id) {
            const { data: inv } = await supabase
              .from("invoice_registry")
              .select("total_amount, invoice_type")
              .eq("id", rec.invoice_id)
              .single();
            if (inv) {
              const paid = rec.reconciled_amount >= inv.total_amount;
              const newStatus = isInflow
                ? (paid ? "incassata" : "parzialmente_incassata")
                : (paid ? "pagata" : "parzialmente_pagata");
              await supabase.from("invoice_registry")
                .update({ financial_status: newStatus, payment_date: mov?.movement_date || new Date().toISOString().split("T")[0] })
                .eq("id", rec.invoice_id);
            }
          }
          if (rec.invoice_id) {
            const { data: scadenze } = await supabase
              .from("scadenze").select("*").eq("fattura_id", rec.invoice_id);
            if (scadenze) {
              for (const s of scadenze) {
                const newResiduo = Math.max(0, s.importo_residuo - rec.reconciled_amount);
                await supabase.from("scadenze").update({
                  importo_residuo: newResiduo,
                  stato: newResiduo <= 0 ? "chiusa" : "parziale",
                }).eq("id", s.id);
              }
            }
          }
        }
      }
      toast.success("Match confermato, Prima Nota e scadenziario aggiornati");
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: [`open-invoices-${direction}`] });
      queryClient.invalidateQueries({ queryKey: ["prima-nota"] });
      queryClient.invalidateQueries({ queryKey: ["scadenze-dettagliate"] });
      queryClient.invalidateQueries({ queryKey: ["scadenze-stats"] });
    } catch (err: any) { toast.error(err.message); }
  };

  const linkToInvoice = async () => {
    if (!selectedMovement || !selectedInvoiceId) return;
    try {
      const movDate = selectedMovement.movement_date || new Date().toISOString().split("T")[0];
      
      // Create prima nota for this reconciliation
      const pnId = await createPrimaNotaForReconciliation(
        selectedMovement.id, selectedInvoiceId, selectedMovement.amount, movDate, isInflow
      );

      await supabase.from("bank_reconciliations").insert({
        bank_movement_id: selectedMovement.id,
        invoice_id: selectedInvoiceId,
        reconciled_amount: selectedMovement.amount,
        match_type: "manual",
        reconciled_by: user?.id,
        prima_nota_id: pnId,
      });
      await supabase.from("bank_movements").update({ status: "matched" }).eq("id", selectedMovement.id);

      // Update invoice_registry financial_status and scadenze
      const { data: inv } = await supabase
        .from("invoice_registry")
        .select("total_amount, invoice_type")
        .eq("id", selectedInvoiceId)
        .single();
      if (inv) {
        const paid = selectedMovement.amount >= inv.total_amount;
        const newStatus = isInflow
          ? (paid ? "incassata" : "parzialmente_incassata")
          : (paid ? "pagata" : "parzialmente_pagata");
        await supabase.from("invoice_registry")
          .update({ financial_status: newStatus, payment_date: movDate })
          .eq("id", selectedInvoiceId);
      }
      // Update scadenze
      const { data: scadenze } = await supabase
        .from("scadenze").select("*").eq("fattura_id", selectedInvoiceId);
      if (scadenze) {
        for (const s of scadenze) {
          const newResiduo = Math.max(0, s.importo_residuo - selectedMovement.amount);
          await supabase.from("scadenze").update({
            importo_residuo: newResiduo,
            stato: newResiduo <= 0 ? "chiusa" : "parziale",
          }).eq("id", s.id);
        }
      }

      toast.success("Fattura collegata, Prima Nota e scadenziario aggiornati");
      setLinkDialogOpen(false);
      setSelectedInvoiceId("");
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: [`open-invoices-${direction}`] });
      queryClient.invalidateQueries({ queryKey: ["prima-nota"] });
      queryClient.invalidateQueries({ queryKey: ["scadenze-dettagliate"] });
      queryClient.invalidateQueries({ queryKey: ["scadenze-stats"] });
    } catch (err: any) { toast.error(err.message); }
  };

  const ignoreMovement = async (id: string) => {
    await supabase.from("bank_movements").update({ status: "ignored" }).eq("id", id);
    queryClient.invalidateQueries({ queryKey });
    toast.success("Movimento ignorato");
  };

  const filtered = movements.filter((m: any) => {
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (m.description || "").toLowerCase().includes(q) ||
        (m.matched_subject_name || "").toLowerCase().includes(q);
    }
    return true;
  });

  const kpis = useMemo(() => ({
    total: movements.length,
    unmatched: movements.filter((m: any) => m.status === "unmatched").length,
    suggested: movements.filter((m: any) => m.status === "suggested").length,
    matched: movements.filter((m: any) => m.status === "matched").length,
    totalAmount: movements.reduce((s: number, m: any) => s + Number(m.amount), 0),
  }), [movements]);

  return (
    <div
      className="space-y-5 mt-4"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-primary/5 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-background border-2 border-dashed border-primary rounded-2xl p-12 shadow-xl text-center">
            <Upload className="h-12 w-12 mx-auto text-primary mb-4" />
            <p className="text-lg font-medium text-foreground">Rilascia il file qui</p>
            <p className="text-sm text-muted-foreground mt-1">PDF, immagini, CSV, XLS, XLSX</p>
          </div>
        </div>
      )}

      {/* Analyzing overlay */}
      {isAnalyzing && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <Card className="w-full max-w-sm">
            <CardContent className="pt-6 text-center space-y-4">
              <RefreshCw className="h-10 w-10 mx-auto text-primary animate-spin" />
              <div>
                <h3 className="text-lg font-semibold">Analisi AI in corso...</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  L'AI sta leggendo e estraendo i movimenti dal documento
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {isInflow ? "Movimenti in entrata e fatture clienti" : "Movimenti in uscita e fatture fornitori"}
        </p>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".csv,.xls,.xlsx,.pdf,.jpg,.jpeg,.png,.webp" onChange={handleFileUpload} className="hidden" />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isImporting || isAnalyzing}>
            <Upload className="h-4 w-4 mr-1" />
            {isAnalyzing ? "Analisi AI..." : isImporting ? "Importando..." : "Import Estratto Conto"}
          </Button>
          <Button onClick={runAutomatch} disabled={isAutoMatching || kpis.unmatched === 0}>
            <RefreshCw className={cn("h-4 w-4 mr-1", isAutoMatching && "animate-spin")} />
            Automatch
          </Button>
        </div>
      </div>

      {/* Empty state with drop zone */}
      {!isLoading && movements.length === 0 && (
        <div
          className={cn(
            "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors",
            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50 hover:bg-accent/30"
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">Importa estratto conto</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Trascina qui il file oppure clicca per selezionarlo
          </p>
          <p className="text-xs text-muted-foreground">
            Formati supportati: PDF, immagini (JPG/PNG), CSV, XLS, XLSX
          </p>
          <p className="text-xs text-primary mt-2">
            🤖 L'AI analizzerà automaticamente il documento ed estrarrà i movimenti
          </p>
        </div>
      )}

      {/* AI Preview Dialog */}
      <Dialog open={aiPreviewOpen} onOpenChange={setAiPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Movimenti estratti dall'AI
            </DialogTitle>
          </DialogHeader>

          {aiBankInfo && (aiBankInfo.bank_name || aiBankInfo.account_iban || aiBankInfo.period) && (
            <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
              {aiBankInfo.bank_name && <p><strong>Banca:</strong> {aiBankInfo.bank_name}</p>}
              {aiBankInfo.account_iban && <p><strong>IBAN:</strong> {aiBankInfo.account_iban}</p>}
              {aiBankInfo.period && <p><strong>Periodo:</strong> {aiBankInfo.period}</p>}
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              {aiMovements.filter(m => m.selected).length} di {aiMovements.length} movimenti selezionati
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAiMovements(prev => prev.map(m => ({ ...m, selected: true })))}
              >
                Seleziona tutti
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAiMovements(prev => prev.map(m => ({ ...m, selected: m.relevant })))}
              >
                Solo {isInflow ? "entrate" : "uscite"}
              </Button>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrizione</TableHead>
                  <TableHead className="text-right">Importo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Rif.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aiMovements.map((m, idx) => (
                  <TableRow
                    key={idx}
                    className={cn(
                      !m.relevant && "opacity-50",
                      m.selected && "bg-primary/5"
                    )}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={m.selected || false}
                        onChange={(e) => {
                          setAiMovements(prev =>
                            prev.map((mov, i) => i === idx ? { ...mov, selected: e.target.checked } : mov)
                          );
                        }}
                        className="h-4 w-4 rounded border-input"
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {m.data_movimento}
                    </TableCell>
                    <TableCell className="text-sm max-w-[300px] truncate">
                      {m.descrizione}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      €{m.importo.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.tipo === "uscita" ? "destructive" : "default"} className="text-xs">
                        {m.tipo === "uscita" ? "Uscita" : "Entrata"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.riferimento || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="bg-muted/30 rounded-lg p-3 text-sm">
            <div className="flex justify-between">
              <span>Totale selezionati:</span>
              <span className="font-bold">
                €{aiMovements.filter(m => m.selected).reduce((s, m) => s + m.importo, 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAiPreviewOpen(false)}>Annulla</Button>
            <Button
              onClick={confirmAiImport}
              disabled={isImporting || aiMovements.filter(m => m.selected).length === 0}
            >
              {isImporting ? "Importando..." : `Importa ${aiMovements.filter(m => m.selected).length} movimenti`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KPIs */}
      {movements.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card><CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Totale</p>
              <p className="text-2xl font-bold tabular-nums">{kpis.total}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Da riconciliare</p>
              <p className="text-2xl font-bold tabular-nums text-amber-600">{kpis.unmatched}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Suggeriti</p>
              <p className="text-2xl font-bold tabular-nums text-blue-600">{kpis.suggested}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Riconciliati</p>
              <p className="text-2xl font-bold tabular-nums text-emerald-600">{kpis.matched}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Importo Totale</p>
              <p className="text-2xl font-bold tabular-nums">
                €{kpis.totalAmount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
              </p>
            </CardContent></Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex gap-2 flex-wrap">
              {[
                { value: "all", label: "Tutti" },
                { value: "unmatched", label: "Da riconciliare" },
                { value: "suggested", label: "Suggeriti" },
                { value: "matched", label: "Riconciliati" },
                { value: "partial", label: "Parziali" },
                { value: "ignored", label: "Ignorati" },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                    statusFilter === f.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca descrizione o soggetto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[100px]">Data</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead className="text-right w-[120px]">Importo</TableHead>
                    <TableHead className="w-[160px]">{isInflow ? "Cliente" : "Fornitore"}</TableHead>
                    <TableHead className="w-[140px]">Match</TableHead>
                    <TableHead className="w-[100px]">Prima Nota</TableHead>
                    <TableHead className="w-[130px]">Stato</TableHead>
                    <TableHead className="w-[180px] text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nessun movimento trovato per il filtro selezionato
                      </TableCell>
                    </TableRow>
                  ) : filtered.map((mov: any) => {
                    const recon = mov.bank_reconciliations?.[0];
                    return (
                      <TableRow key={mov.id} className={mov.status === "unmatched" ? "bg-amber-50/30" : ""}>
                        <TableCell className="text-sm tabular-nums">
                          {format(new Date(mov.movement_date), "dd/MM/yy")}
                        </TableCell>
                        <TableCell className="text-sm max-w-[300px] truncate">{mov.description}</TableCell>
                        <TableCell className={cn(
                          "text-right font-medium tabular-nums",
                          isInflow ? "text-emerald-700" : "text-red-600"
                        )}>
                          {isInflow ? "+" : "-"}€{Number(mov.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-sm">{mov.matched_subject_name || "—"}</TableCell>
                        <TableCell className="text-sm">
                          {recon ? (
                            <div className="space-y-0.5">
                              <span className="text-xs">
                                {recon.match_type === "auto" ? "🤖 Auto" : recon.match_type === "suggested" ? "💡 Suggerito" : "🔗 Manuale"}
                                {recon.match_score && <span className="ml-1 text-muted-foreground">({Math.round(recon.match_score)}%)</span>}
                              </span>
                              {(mov.status === "suggested") && (() => {
                                const linkedInv = getLinkedInvoice(recon);
                                return linkedInv ? (
                                  <p className="text-[10px] text-muted-foreground leading-tight truncate max-w-[200px]" title={`${linkedInv.invoice_number} - ${linkedInv.subject_name} - €${linkedInv.total_amount?.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`}>
                                    📄 {linkedInv.invoice_number} — €{linkedInv.total_amount?.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                                  </p>
                                ) : recon.notes ? (
                                  <p className="text-[10px] text-muted-foreground leading-tight truncate max-w-[200px]" title={recon.notes}>
                                    📄 {recon.notes.replace("Match: ", "")}
                                  </p>
                                ) : null;
                              })()}
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <span className={cn(
                            "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                            statusConfig[mov.status as MovementStatus]?.color
                          )}>
                            {statusConfig[mov.status as MovementStatus]?.label || mov.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {mov.status === "suggested" && (
                              <Button size="sm" variant="ghost" onClick={() => confirmMatch(mov.id)} title="Conferma match">
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              </Button>
                            )}
                            {(mov.status === "unmatched" || mov.status === "suggested") && (
                              <Button size="sm" variant="ghost" onClick={() => { setSelectedMovement(mov); setLinkDialogOpen(true); }} title="Collega fattura">
                                <Link2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {mov.status === "unmatched" && (
                              <Button size="sm" variant="ghost" onClick={() => { setSelectedMovement(mov); setCreateDialogOpen(true); }} title={isInflow ? "Crea fattura" : "Registra costo"}>
                                <Plus className="h-3.5 w-3.5 text-blue-600" />
                              </Button>
                            )}
                            {mov.status !== "matched" && mov.status !== "ignored" && (
                              <Button size="sm" variant="ghost" onClick={() => ignoreMovement(mov.id)} title="Ignora">
                                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* Link Invoice Dialog - Improved UX */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Collega a {isInflow ? "Fattura Cliente" : "Fattura Fornitore"}
            </DialogTitle>
          </DialogHeader>
          {selectedMovement && (
            <LinkInvoicePanel
              movement={selectedMovement}
              invoices={openInvoices}
              isInflow={isInflow}
              onSelect={(invoiceId) => { setSelectedInvoiceId(invoiceId); }}
              selectedInvoiceId={selectedInvoiceId}
            />
          )}
          <DialogFooter className="border-t pt-3">
            <Button variant="outline" onClick={() => { setLinkDialogOpen(false); setSelectedInvoiceId(""); }}>Annulla</Button>
            <Button onClick={linkToInvoice} disabled={!selectedInvoiceId} className="gap-1">
              <Check className="h-4 w-4" />
              Collega Fattura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Invoice / Register Cost Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isInflow ? "Crea Fattura da Movimento" : "Registra Costo"}</DialogTitle>
          </DialogHeader>
          {selectedMovement && isInflow && (
            <CreateInvoiceForm
              movement={selectedMovement}
              onCreated={async (invoiceId) => {
                await supabase.from("bank_reconciliations").insert({
                  bank_movement_id: selectedMovement.id,
                  invoice_id: invoiceId,
                  reconciled_amount: selectedMovement.amount,
                  match_type: "manual",
                  reconciled_by: user?.id,
                });
                await supabase.from("bank_movements").update({ status: "matched" }).eq("id", selectedMovement.id);
                setCreateDialogOpen(false);
                queryClient.invalidateQueries({ queryKey });
                toast.success("Fattura creata e movimento riconciliato");
              }}
              onCancel={() => setCreateDialogOpen(false)}
            />
          )}
          {selectedMovement && !isInflow && (
            <RegisterCostForm
              movement={selectedMovement}
              userId={user?.id}
              onRegistered={async () => {
                await supabase.from("bank_movements").update({ status: "matched" }).eq("id", selectedMovement.id);
                setCreateDialogOpen(false);
                queryClient.invalidateQueries({ queryKey });
                toast.success("Costo registrato e movimento riconciliato");
              }}
              onCancel={() => setCreateDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Sub-forms ---

function CreateInvoiceForm({ movement, onCreated, onCancel }: {
  movement: any; onCreated: (id: string) => void; onCancel: () => void;
}) {
  const [subjectName, setSubjectName] = useState(movement.matched_subject_name || "");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!subjectName || !invoiceNumber) { toast.error("Compilare cliente e numero fattura"); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.from("invoice_registry").insert({
        invoice_type: "vendita",
        invoice_number: invoiceNumber,
        invoice_date: movement.movement_date,
        subject_name: subjectName,
        subject_type: "cliente",
        imponibile: Number(movement.amount) / 1.22,
        iva_rate: 22,
        iva_amount: Number(movement.amount) - Number(movement.amount) / 1.22,
        total_amount: Number(movement.amount),
        vat_regime: "ordinario",
        financial_status: "incassata",
        status: "bozza",
        payment_date: movement.movement_date,
        notes,
      }).select("id").single();
      if (error) throw error;
      onCreated(data.id);
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-muted/30 p-3 rounded-lg text-sm">
        <p><strong>Importo:</strong> €{Number(movement.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>
        <p><strong>Data:</strong> {format(new Date(movement.movement_date), "dd/MM/yyyy")}</p>
      </div>
      <div><Label>Cliente *</Label><Input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="Nome cliente" /></div>
      <div><Label>Numero Fattura *</Label><Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="FV-2026-001" /></div>
      <div><Label>Note</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Annulla</Button>
        <Button onClick={handleCreate} disabled={saving}>{saving ? "Salvataggio..." : "Crea Fattura"}</Button>
      </div>
    </div>
  );
}

function RegisterCostForm({ movement, userId, onRegistered, onCancel }: {
  movement: any; userId?: string; onRegistered: () => void; onCancel: () => void;
}) {
  const [supplierName, setSupplierName] = useState(movement.matched_subject_name || "");
  const [category, setCategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bonifico");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleRegister = async () => {
    if (!supplierName) { toast.error("Inserire il fornitore"); return; }
    setSaving(true);
    try {
      // Create invoice_registry entry so it appears in Registro Contabile
      const netAmount = Number(movement.amount) / 1.22;
      const vatAmount = Number(movement.amount) - netAmount;
      const { data: invoiceData } = await supabase.from("invoice_registry").insert({
        invoice_type: "acquisto",
        invoice_number: `ACQ-${format(new Date(movement.movement_date), "yyyyMMdd")}-${movement.id.substring(0, 4).toUpperCase()}`,
        invoice_date: movement.movement_date,
        subject_name: supplierName,
        subject_type: "fornitore",
        imponibile: netAmount,
        iva_rate: 22,
        iva_amount: vatAmount,
        total_amount: Number(movement.amount),
        vat_regime: "ordinario",
        financial_status: "pagata",
        status: "contabilizzata",
        payment_date: movement.movement_date,
        notes: `${category ? `Categoria: ${category}. ` : ""}${notes}`.trim(),
      }).select("id").single();

      // Also create accounting_entries for backward compatibility
      await supabase.from("accounting_entries").insert({
        document_type: "fattura_acquisto",
        document_date: movement.movement_date,
        amount: Number(movement.amount),
        direction: "uscita",
        attachment_url: "",
        status: "classificato",
        subject_type: "fornitore",
        note: `Costo registrato da riconciliazione bancaria - ${supplierName}. ${notes}`,
        payment_method: paymentMethod,
        user_id: userId,
      });
      await supabase.from("bank_reconciliations").insert({
        bank_movement_id: movement.id,
        invoice_id: invoiceData?.id || null,
        reconciled_amount: movement.amount,
        match_type: "manual",
        notes: `Costo: ${supplierName} - ${category || "Non categorizzato"}`,
        reconciled_by: userId,
      });
      onRegistered();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-muted/30 p-3 rounded-lg text-sm">
        <p><strong>Importo:</strong> €{Number(movement.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>
        <p><strong>Data:</strong> {format(new Date(movement.movement_date), "dd/MM/yyyy")}</p>
      </div>
      <div><Label>Fornitore *</Label><Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Nome fornitore" /></div>
      <div>
        <Label>Categoria</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue placeholder="Seleziona categoria..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="materie_prime">Materie Prime</SelectItem>
            <SelectItem value="servizi">Servizi</SelectItem>
            <SelectItem value="utenze">Utenze</SelectItem>
            <SelectItem value="affitto">Affitto</SelectItem>
            <SelectItem value="personale">Personale</SelectItem>
            <SelectItem value="manutenzione">Manutenzione</SelectItem>
            <SelectItem value="altro">Altro</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Metodo Pagamento</Label>
        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="bonifico">Bonifico</SelectItem>
            <SelectItem value="carta">Carta</SelectItem>
            <SelectItem value="contanti">Contanti</SelectItem>
            <SelectItem value="banca">Banca</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div><Label>Note</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Annulla</Button>
        <Button onClick={handleRegister} disabled={saving}>{saving ? "Salvataggio..." : "Registra Costo"}</Button>
      </div>
    </div>
  );
}

// --- Link Invoice Panel with search and smart display ---
function LinkInvoicePanel({ movement, invoices, isInflow, onSelect, selectedInvoiceId }: {
  movement: any;
  invoices: any[];
  isInflow: boolean;
  onSelect: (id: string) => void;
  selectedInvoiceId: string;
}) {
  const [search, setSearch] = useState("");
  const movAmount = Number(movement.amount);

  const scored = useMemo(() => {
    return invoices.map((inv: any) => {
      const diff = Math.abs(inv.total_amount - movAmount);
      const exactMatch = diff < 0.01;
      const closeMatch = diff < movAmount * 0.05;
      const desc = (movement.description || "").toLowerCase();
      const nameMatch = inv.subject_name && desc.includes(inv.subject_name.toLowerCase());
      const invNumMatch = inv.invoice_number && desc.includes(inv.invoice_number.toLowerCase());
      return { ...inv, exactMatch, closeMatch, nameMatch, invNumMatch, diff };
    }).sort((a: any, b: any) => {
      if (a.exactMatch && !b.exactMatch) return -1;
      if (!a.exactMatch && b.exactMatch) return 1;
      if (a.nameMatch && !b.nameMatch) return -1;
      if (!a.nameMatch && b.nameMatch) return 1;
      return a.diff - b.diff;
    });
  }, [invoices, movAmount, movement.description]);

  const filtered = scored.filter((inv: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (inv.invoice_number || "").toLowerCase().includes(q) ||
      (inv.subject_name || "").toLowerCase().includes(q) ||
      String(inv.total_amount).includes(q);
  });

  return (
    <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
      {/* Movement info */}
      <div className="bg-muted/40 rounded-lg p-3 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Movimento bancario</span>
          <span className={cn("text-lg font-bold tabular-nums", isInflow ? "text-emerald-700" : "text-red-600")}>
            {isInflow ? "+" : "-"}€{movAmount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {format(new Date(movement.movement_date), "dd/MM/yyyy")} — {movement.description?.substring(0, 120)}
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca per numero fattura, soggetto o importo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Invoice list */}
      <div className="flex-1 overflow-y-auto border rounded-lg divide-y max-h-[40vh]">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Nessuna fattura trovata</div>
        ) : filtered.map((inv: any) => {
          const isSelected = selectedInvoiceId === inv.id;
          return (
            <div
              key={inv.id}
              className={cn(
                "p-3 cursor-pointer transition-colors hover:bg-accent/50",
                isSelected && "bg-primary/10 border-l-2 border-l-primary",
                inv.exactMatch && !isSelected && "bg-emerald-50/50"
              )}
              onClick={() => onSelect(inv.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{inv.invoice_number}</span>
                    {inv.exactMatch && (
                      <Badge className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0">
                        💰 Importo esatto
                      </Badge>
                    )}
                    {inv.closeMatch && !inv.exactMatch && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        ≈ Importo simile
                      </Badge>
                    )}
                    {inv.nameMatch && (
                      <Badge className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0">
                        👤 Nome trovato
                      </Badge>
                    )}
                    {inv.invNumMatch && (
                      <Badge className="bg-purple-100 text-purple-800 text-[10px] px-1.5 py-0">
                        🔢 Rif. fattura
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {inv.subject_name} — {inv.invoice_date ? format(new Date(inv.invoice_date), "dd/MM/yyyy") : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={cn(
                    "font-mono text-sm font-medium tabular-nums",
                    inv.exactMatch ? "text-emerald-700" : ""
                  )}>
                    €{inv.total_amount?.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                  </p>
                  {!inv.exactMatch && (
                    <p className="text-[10px] text-muted-foreground">
                      Δ €{inv.diff?.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.some((inv: any) => inv.exactMatch || inv.nameMatch) && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          💡 Le fatture sono ordinate per corrispondenza con il movimento
        </p>
      )}
    </div>
  );
}
