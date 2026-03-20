import { useState, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import {
  Upload, Search, Check, Link2, Plus, EyeOff, RefreshCw, FileSpreadsheet, ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type MovementStatus = "unmatched" | "suggested" | "matched" | "partial" | "ignored";

const statusConfig: Record<MovementStatus, { label: string; color: string }> = {
  unmatched: { label: "Da riconciliare", color: "bg-amber-100 text-amber-800" },
  suggested: { label: "Match suggerito", color: "bg-blue-100 text-blue-800" },
  matched: { label: "Riconciliato", color: "bg-emerald-100 text-emerald-800" },
  partial: { label: "Parziale", color: "bg-orange-100 text-orange-800" },
  ignored: { label: "Ignorato", color: "bg-gray-100 text-gray-600" },
};

export default function RiconciliazionePagamentiPage() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [registerCostDialog, setRegisterCostDialog] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<any>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isAutoMatching, setIsAutoMatching] = useState(false);

  // Fetch outflow movements
  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["bank-movements-outflow"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_movements")
        .select("*, bank_reconciliations(*)")
        .eq("direction", "outflow")
        .order("movement_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch open supplier invoices (acquisto)
  const { data: openInvoices = [] } = useQuery({
    queryKey: ["open-supplier-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_registry")
        .select("*")
        .in("invoice_type", ["acquisto", "nota_credito_acquisto"])
        .in("financial_status", ["da_pagare", "parzialmente_pagata"])
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // File import
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { raw: false });

      if (rows.length === 0) { toast.error("File vuoto"); return; }

      const batchId = crypto.randomUUID();
      const items = rows.map((row) => {
        let amount = parseFloat(
          String(row.Importo || row.Amount || row.importo || row.amount || "0")
            .replace(/[€\s]/g, "").replace(",", ".")
        );
        if (isNaN(amount)) return null;
        // Handle negative amounts (outflow)
        amount = Math.abs(amount);
        if (amount === 0) return null;

        const dateStr = row.Data || row.Date || row.data || row.date || row["Data Operazione"] || "";
        let movDate: string;
        try {
          const d = new Date(dateStr);
          movDate = isNaN(d.getTime()) ? new Date().toISOString().split("T")[0] : d.toISOString().split("T")[0];
        } catch { movDate = new Date().toISOString().split("T")[0]; }

        return {
          import_batch_id: batchId,
          movement_date: movDate,
          description: row.Descrizione || row.Description || row.descrizione || row.Causale || "",
          amount,
          direction: "outflow" as const,
          bank_account: row.Conto || null,
          iban: row.IBAN || row.iban || null,
          reference: row.Riferimento || row.CRO || null,
          raw_data: row,
          status: "unmatched" as const,
          imported_by: user?.id,
        };
      }).filter(Boolean);

      if (items.length === 0) { toast.error("Nessun movimento in uscita trovato"); return; }

      const { error } = await supabase.from("bank_movements").insert(items as any);
      if (error) throw error;

      toast.success(`${items.length} movimenti importati`);
      queryClient.invalidateQueries({ queryKey: ["bank-movements-outflow"] });
    } catch (err: any) {
      toast.error("Errore: " + err.message);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [user, queryClient]);

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
            scadenza_id: bestMatch.scadenza_id,
            reconciled_amount: mov.amount,
            match_type: bestScore >= 70 ? "auto" : "suggested",
            match_score: bestScore,
            reconciled_by: user?.id,
          });
          matchCount++;
        }
      }

      toast.success(`Automatch: ${matchCount} match su ${unmatched.length} movimenti`);
      queryClient.invalidateQueries({ queryKey: ["bank-movements-outflow"] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsAutoMatching(false);
    }
  }, [movements, openInvoices, user, queryClient]);

  // Confirm match
  const confirmMatch = async (movementId: string) => {
    try {
      await supabase.from("bank_movements").update({ status: "matched" }).eq("id", movementId);
      
      const { data: recons } = await supabase
        .from("bank_reconciliations")
        .select("invoice_id, reconciled_amount")
        .eq("bank_movement_id", movementId);
      
      if (recons) {
        for (const rec of recons) {
          if (rec.invoice_id) {
            const { data: inv } = await supabase
              .from("invoice_registry")
              .select("total_amount")
              .eq("id", rec.invoice_id)
              .single();
            if (inv) {
              const newStatus = rec.reconciled_amount >= inv.total_amount ? "pagata" : "parzialmente_pagata";
              await supabase.from("invoice_registry")
                .update({ financial_status: newStatus, payment_date: new Date().toISOString().split("T")[0] })
                .eq("id", rec.invoice_id);
            }
          }
          if (recons[0]?.invoice_id) {
            const { data: scadenze } = await supabase
              .from("scadenze")
              .select("*")
              .eq("fattura_id", recons[0].invoice_id);
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

      toast.success("Match confermato");
      queryClient.invalidateQueries({ queryKey: ["bank-movements-outflow"] });
      queryClient.invalidateQueries({ queryKey: ["open-supplier-invoices"] });
    } catch (err: any) { toast.error(err.message); }
  };

  const linkToInvoice = async () => {
    if (!selectedMovement || !selectedInvoiceId) return;
    try {
      await supabase.from("bank_reconciliations").insert({
        bank_movement_id: selectedMovement.id,
        invoice_id: selectedInvoiceId,
        reconciled_amount: selectedMovement.amount,
        match_type: "manual",
        reconciled_by: user?.id,
      });
      await supabase.from("bank_movements").update({ status: "suggested" }).eq("id", selectedMovement.id);
      toast.success("Fattura fornitore collegata");
      setLinkDialogOpen(false);
      setSelectedInvoiceId("");
      queryClient.invalidateQueries({ queryKey: ["bank-movements-outflow"] });
    } catch (err: any) { toast.error(err.message); }
  };

  const ignoreMovement = async (id: string) => {
    await supabase.from("bank_movements").update({ status: "ignored" }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["bank-movements-outflow"] });
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

  const kpis = {
    total: movements.length,
    unmatched: movements.filter((m: any) => m.status === "unmatched").length,
    suggested: movements.filter((m: any) => m.status === "suggested").length,
    matched: movements.filter((m: any) => m.status === "matched").length,
    totalAmount: movements.reduce((s: number, m: any) => s + Number(m.amount), 0),
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Riconciliazione Pagamenti</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestione movimenti bancari in uscita e collegamento fatture fornitori</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".csv,.xls,.xlsx" onChange={handleFileUpload} className="hidden" />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            <Upload className="h-4 w-4 mr-1" />{isImporting ? "Importando..." : "Import Movimenti"}
          </Button>
          <Button onClick={runAutomatch} disabled={isAutoMatching || kpis.unmatched === 0}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isAutoMatching ? "animate-spin" : ""}`} />Automatch
          </Button>
        </div>
      </div>

      {/* KPIs */}
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
          <p className="text-2xl font-bold tabular-nums">€{kpis.totalAmount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>
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
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === f.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >{f.label}</button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">Nessun movimento</h3>
          <p className="text-sm text-muted-foreground">Importa un estratto conto per iniziare</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[100px]">Data</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead className="text-right w-[120px]">Importo</TableHead>
                <TableHead className="w-[160px]">Fornitore</TableHead>
                <TableHead className="w-[160px]">Match</TableHead>
                <TableHead className="w-[130px]">Stato</TableHead>
                <TableHead className="w-[200px] text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((mov: any) => {
                const recon = mov.bank_reconciliations?.[0];
                return (
                  <TableRow key={mov.id} className={mov.status === "unmatched" ? "bg-amber-50/30" : ""}>
                    <TableCell className="text-sm tabular-nums">{format(new Date(mov.movement_date), "dd/MM/yy")}</TableCell>
                    <TableCell className="text-sm max-w-[300px] truncate">{mov.description}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-red-600">
                      -€{Number(mov.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-sm">{mov.matched_subject_name || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {recon ? (
                        <span className="text-xs">
                          {recon.match_type === "auto" ? "🤖 Auto" : recon.match_type === "suggested" ? "💡 Suggerito" : "🔗 Manuale"}
                          {recon.match_score && <span className="ml-1 text-muted-foreground">({Math.round(recon.match_score)}%)</span>}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[mov.status as MovementStatus]?.color || ""}`}>
                        {statusConfig[mov.status as MovementStatus]?.label || mov.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {mov.status === "suggested" && (
                          <Button size="sm" variant="ghost" onClick={() => confirmMatch(mov.id)} title="Conferma">
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          </Button>
                        )}
                        {(mov.status === "unmatched" || mov.status === "suggested") && (
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedMovement(mov); setLinkDialogOpen(true); }} title="Collega fattura">
                            <Link2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {mov.status === "unmatched" && (
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedMovement(mov); setRegisterCostDialog(true); }} title="Registra costo">
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

      {/* Link Invoice Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Collega a Fattura Fornitore</DialogTitle></DialogHeader>
          {selectedMovement && (
            <div className="space-y-4">
              <div className="bg-muted/30 p-3 rounded-lg text-sm">
                <p><strong>Importo:</strong> €{Number(selectedMovement.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>
                <p className="truncate"><strong>Descrizione:</strong> {selectedMovement.description}</p>
              </div>
              <div>
                <Label>Seleziona Fattura Fornitore</Label>
                <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId}>
                  <SelectTrigger><SelectValue placeholder="Seleziona fattura..." /></SelectTrigger>
                  <SelectContent>
                    {openInvoices.map((inv: any) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.invoice_number} — {inv.subject_name} — €{inv.total_amount?.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Annulla</Button>
            <Button onClick={linkToInvoice} disabled={!selectedInvoiceId}>Collega</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Register Cost Dialog */}
      <Dialog open={registerCostDialog} onOpenChange={setRegisterCostDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Registra Costo</DialogTitle></DialogHeader>
          {selectedMovement && (
            <RegisterCostForm
              movement={selectedMovement}
              userId={user?.id}
              onRegistered={async () => {
                await supabase.from("bank_movements").update({ status: "matched" }).eq("id", selectedMovement.id);
                setRegisterCostDialog(false);
                queryClient.invalidateQueries({ queryKey: ["bank-movements-outflow"] });
                toast.success("Costo registrato e movimento riconciliato");
              }}
              onCancel={() => setRegisterCostDialog(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RegisterCostForm({ movement, userId, onRegistered, onCancel }: {
  movement: any; userId?: string;
  onRegistered: () => void; onCancel: () => void;
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
      // Create accounting entry
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

      // Create bank reconciliation
      await supabase.from("bank_reconciliations").insert({
        bank_movement_id: movement.id,
        reconciled_amount: movement.amount,
        match_type: "manual",
        notes: `Costo: ${supplierName} - ${category || "Non categorizzato"}`,
        reconciled_by: userId,
      });

      onRegistered();
    } catch (err: any) {
      toast.error(err.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-muted/30 p-3 rounded-lg text-sm">
        <p><strong>Importo:</strong> €{Number(movement.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>
        <p><strong>Data:</strong> {format(new Date(movement.movement_date), "dd/MM/yyyy")}</p>
      </div>
      <div>
        <Label>Fornitore *</Label>
        <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Nome fornitore" />
      </div>
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
      <div>
        <Label>Note</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Annulla</Button>
        <Button onClick={handleRegister} disabled={saving}>{saving ? "Salvataggio..." : "Registra Costo"}</Button>
      </div>
    </div>
  );
}
