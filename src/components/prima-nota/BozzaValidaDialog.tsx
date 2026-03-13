import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format, addMonths, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import {
  ArrowUp, ArrowDown, CheckCircle, Sparkles, Loader2,
  ExternalLink, Eye, FileText, Trash2, Send
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

// =====================================================
// TYPES
// =====================================================

interface BozzaEntry {
  id: string;
  direction: string;
  document_type: string;
  amount: number;
  document_date: string;
  attachment_url: string;
  payment_method: string | null;
  subject_type: string | null;
  note: string | null;
  status: string;
  created_at: string;
  event_type?: string | null;
  affects_income_statement?: boolean | null;
  chart_account_id?: string | null;
  temporal_competence?: string | null;
  is_recurring?: boolean | null;
  recurrence_period?: string | null;
  recurrence_start_date?: string | null;
  recurrence_end_date?: string | null;
  cost_center_id?: string | null;
  profit_center_id?: string | null;
  center_percentage?: number | null;
  economic_subject_type?: string | null;
  economic_subject_id?: string | null;
  financial_status?: string | null;
  payment_date?: string | null;
  cfo_notes?: string | null;
  iva_mode?: string | null;
  iva_aliquota?: number | null;
  imponibile?: number | null;
  iva_amount?: number | null;
  totale?: number | null;
}

interface BozzaValidaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: BozzaEntry | null;
}

// =====================================================
// CONSTANTS
// =====================================================

const eventTypes = [
  { value: "ricavo", label: "Ricavo" },
  { value: "costo", label: "Costo" },
  { value: "evento_finanziario", label: "Evento finanziario" },
  { value: "assestamento", label: "Assestamento" },
  { value: "evento_interno", label: "Evento interno" },
];

const temporalCompetences = [
  { value: "immediata", label: "Immediata" },
  { value: "differita", label: "Differita" },
  { value: "rateizzata", label: "Rateizzata" },
];

const financialStatuses = [
  { value: "pagato", label: "Pagato" },
  { value: "da_pagare", label: "Da pagare" },
  { value: "incassato", label: "Incassato" },
  { value: "da_incassare", label: "Da incassare" },
];

import { IVA_MODE_LABELS, isZeroIvaMode, normalizeIvaMode, formatPaymentMethod, generateDoubleEntryLines } from "@/lib/accounting-utils";

// =====================================================
// COMPONENT
// =====================================================

export function BozzaValidaDialog({ open, onOpenChange, entry }: BozzaValidaDialogProps) {
  const queryClient = useQueryClient();
  const [isClassifying, setIsClassifying] = useState(false);
  const [form, setForm] = useState({
    event_type: "",
    affects_income_statement: false,
    chart_account_id: "",
    temporal_competence: "immediata",
    recurrence_start_date: "",
    recurrence_end_date: "",
    cost_center_id: "",
    profit_center_id: "",
    center_percentage: 100,
    financial_status: "",
    payment_method: "",
    cfo_notes: "",
    iva_mode: "ORDINARIO_22",
    iva_aliquota: 22,
    imponibile: 0,
    iva_amount: 0,
    totale: 0,
  });

  // Load reference data
  const { data: accounts = [] } = useQuery({
    queryKey: ["chart-of-accounts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name, account_type, level")
        .eq("is_active", true)
        .order("code");
      return data || [];
    },
  });

  const { data: costCenters = [] } = useQuery({
    queryKey: ["cost-centers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cost_centers")
        .select("id, name, code")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  const { data: profitCenters = [] } = useQuery({
    queryKey: ["profit-centers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profit_centers")
        .select("id, name, code")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  // Populate form from entry when opened
  useEffect(() => {
    if (entry && open) {
      setForm({
        event_type: entry.event_type || (entry.direction === "entrata" ? "ricavo" : "costo"),
        affects_income_statement: entry.affects_income_statement ?? true,
        chart_account_id: entry.chart_account_id || "",
        temporal_competence: entry.temporal_competence || "immediata",
        recurrence_start_date: entry.recurrence_start_date || "",
        recurrence_end_date: entry.recurrence_end_date || "",
        cost_center_id: entry.cost_center_id || "",
        profit_center_id: entry.profit_center_id || "",
        center_percentage: entry.center_percentage ?? 100,
        financial_status: entry.financial_status || "",
        payment_method: entry.payment_method || "",
        cfo_notes: entry.cfo_notes || "",
        iva_mode: normalizeIvaMode(entry.iva_mode),
        iva_aliquota: entry.iva_aliquota || 22,
        imponibile: entry.imponibile || entry.amount || 0,
        iva_amount: entry.iva_amount || 0,
        totale: entry.totale || entry.amount || 0,
      });
    }
  }, [entry, open]);

  // AI Classification
  const handleAIClassify = async () => {
    if (!entry) return;
    setIsClassifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("classify-accounting-entry", {
        body: {
          entry,
          chartOfAccounts: accounts.filter(a => a.level === null || a.level === undefined || (a.level as number) >= 2),
          costCenters,
          profitCenters,
        },
      });
      if (error) throw error;
      if (data?.success && data?.classification) {
        const c = data.classification;
        setForm(prev => ({
          ...prev,
          event_type: c.event_type || prev.event_type,
          affects_income_statement: c.affects_income_statement ?? prev.affects_income_statement,
          chart_account_id: c.chart_account_id || prev.chart_account_id,
          temporal_competence: c.temporal_competence || prev.temporal_competence,
          cost_center_id: c.cost_center_id || prev.cost_center_id,
          profit_center_id: c.profit_center_id || prev.profit_center_id,
          financial_status: c.financial_status || prev.financial_status,
        }));
        toast.success("Classificazione AI completata! Verifica e conferma.");
      }
    } catch (err) {
      toast.error("Errore classificazione AI");
    } finally {
      setIsClassifying(false);
    }
  };

  // Unified: Validate + Classify + Generate Prima Nota
  const validateAndGenerateMutation = useMutation({
    mutationFn: async () => {
      if (!entry) throw new Error("No entry");

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      // 1. Update accounting_entry with classification
      const { error: updateError } = await supabase
        .from("accounting_entries")
        .update({
          event_type: form.event_type || null,
          affects_income_statement: form.affects_income_statement,
          chart_account_id: form.chart_account_id || null,
          temporal_competence: form.temporal_competence,
          recurrence_start_date: form.temporal_competence === "rateizzata" ? form.recurrence_start_date || null : null,
          recurrence_end_date: form.temporal_competence === "rateizzata" ? form.recurrence_end_date || null : null,
          cost_center_id: form.cost_center_id || null,
          profit_center_id: form.profit_center_id || null,
          center_percentage: form.center_percentage,
          financial_status: form.financial_status || null,
          payment_method: form.payment_method || null,
          cfo_notes: form.cfo_notes || null,
          iva_mode: form.iva_mode,
          iva_aliquota: form.iva_aliquota,
          imponibile: form.imponibile,
          iva_amount: form.iva_amount,
          totale: form.totale,
          classified_by: userId,
          classified_at: new Date().toISOString(),
          status: "registrato",
        })
        .eq("id", entry.id);

      if (updateError) throw updateError;

      // 2. Generate Prima Nota
      const ivaMode = form.iva_mode || "ORDINARIO_22";
      const ivaAliquota = form.iva_aliquota || 22;
      let imponibile = form.imponibile || entry.amount;
      let ivaAmount = form.iva_amount || 0;
      let totale = form.totale || entry.amount;

      // Recalculate IVA if needed
      if (ivaMode === "ORDINARIO_22") {
        if (!form.iva_amount && !form.totale) {
          ivaAmount = imponibile * (ivaAliquota / 100);
          totale = imponibile + ivaAmount;
        }
      } else if (isZeroIvaMode(ivaMode)) {
        ivaAmount = 0;
        totale = imponibile;
      }

      const isRevenue = form.event_type === "ricavo" || entry.direction === "entrata";
      const isPaid = ["pagato", "incassato"].includes(form.financial_status || "");
      const paymentMethod = form.payment_method || "banca";

      const movementsToCreate: any[] = [];
      const linesToCreate: any[] = [];

      if (form.temporal_competence !== "rateizzata") {
        const movementId = crypto.randomUUID();
        const description = isPaid
          ? `${isRevenue ? "Ricavo" : "Costo"} - Pagato subito`
          : `${isRevenue ? "Ricavo" : "Costo"} - Competenza immediata`;

        movementsToCreate.push({
          id: movementId,
          accounting_entry_id: entry.id,
          movement_type: "economico",
          competence_date: entry.document_date,
          amount: isRevenue ? totale : -totale,
          chart_account_id: form.chart_account_id || null,
          cost_center_id: form.cost_center_id || null,
          profit_center_id: form.profit_center_id || null,
          center_percentage: form.center_percentage || 100,
          description,
          status: "registrato",
          is_rectification: false,
          iva_mode: ivaMode,
          iva_aliquota: ivaAliquota,
          imponibile,
          iva_amount: ivaAmount,
          totale,
          payment_method: isPaid ? paymentMethod : null,
          created_by: userId,
        });

        linesToCreate.push(...generateDoubleEntryLines(
          movementId, isRevenue, isPaid, ivaMode, ivaAliquota,
          imponibile, ivaAmount, totale, paymentMethod, form.chart_account_id || null
        ));
      } else if (form.recurrence_start_date && form.recurrence_end_date) {
        const startDate = new Date(form.recurrence_start_date);
        const endDate = new Date(form.recurrence_end_date);
        let months = 0;
        let currentDate = startOfMonth(startDate);
        while (currentDate <= endDate) { months++; currentDate = addMonths(currentDate, 1); }

        if (months > 0) {
          const instImponibile = imponibile / months;
          const instIva = ivaAmount / months;
          const instTotale = totale / months;

          for (let i = 0; i < months; i++) {
            const competenceDate = addMonths(startOfMonth(startDate), i);
            const movementId = crypto.randomUUID();

            movementsToCreate.push({
              id: movementId,
              accounting_entry_id: entry.id,
              movement_type: "economico",
              competence_date: format(competenceDate, "yyyy-MM-dd"),
              amount: isRevenue ? instTotale : -instTotale,
              chart_account_id: form.chart_account_id || null,
              cost_center_id: form.cost_center_id || null,
              profit_center_id: form.profit_center_id || null,
              center_percentage: form.center_percentage || 100,
              description: `Competenza rateizzata ${i + 1}/${months}`,
              installment_number: i + 1,
              total_installments: months,
              status: "registrato",
              is_rectification: false,
              iva_mode: ivaMode,
              iva_aliquota: ivaAliquota,
              imponibile: instImponibile,
              iva_amount: instIva,
              totale: instTotale,
              payment_method: null,
              created_by: userId,
            });

            linesToCreate.push(...generateDoubleEntryLines(
              movementId, isRevenue, false, ivaMode, ivaAliquota,
              instImponibile, instIva, instTotale, null, form.chart_account_id || null
            ));
          }
        }
      }

      if (movementsToCreate.length > 0) {
        const { error: insertError } = await supabase.from("prima_nota").insert(movementsToCreate);
        if (insertError) throw insertError;
        if (linesToCreate.length > 0) {
          const { error: linesError } = await supabase.from("prima_nota_lines").insert(linesToCreate);
          if (linesError) throw linesError;
        }
      }

      return movementsToCreate.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["prima-nota"] });
      queryClient.invalidateQueries({ queryKey: ["prima-nota-movements"] });
      queryClient.invalidateQueries({ queryKey: ["pending-prima-nota-entries"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-entries-to-classify"] });
      queryClient.invalidateQueries({ queryKey: ["bozze-prima-nota"] });
      toast.success(`Bozza validata e ${count} movimenti generati con successo`);
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error("Errore: " + (err.message || "Errore nella validazione"));
    },
  });

  // Save as draft (keep in da_classificare)
  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      if (!entry) throw new Error("No entry");
      const { error } = await supabase
        .from("accounting_entries")
        .update({
          event_type: form.event_type || null,
          chart_account_id: form.chart_account_id || null,
          cost_center_id: form.cost_center_id || null,
          profit_center_id: form.profit_center_id || null,
          financial_status: form.financial_status || null,
          payment_method: form.payment_method || null,
          cfo_notes: form.cfo_notes || null,
          iva_mode: form.iva_mode,
          iva_aliquota: form.iva_aliquota,
          imponibile: form.imponibile,
          iva_amount: form.iva_amount,
          totale: form.totale,
          status: "in_classificazione",
        })
        .eq("id", entry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bozze-prima-nota"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-entries-to-classify"] });
      toast.success("Bozza salvata");
      onOpenChange(false);
    },
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!entry) return;
      const { error } = await supabase.from("accounting_entries").delete().eq("id", entry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bozze-prima-nota"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-entries-to-classify"] });
      toast.success("Bozza eliminata");
      onOpenChange(false);
    },
  });

  if (!entry) return null;

  const isEntrata = entry.direction === "entrata";
  const canValidate = form.event_type && form.chart_account_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${isEntrata ? "bg-green-100 text-green-600 dark:bg-green-900/30" : "bg-red-100 text-red-600 dark:bg-red-900/30"}`}>
              {isEntrata ? <ArrowUp className="h-5 w-5" /> : <ArrowDown className="h-5 w-5" />}
            </div>
            <div>
              <span className="text-xl">€ {(form.totale || entry.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
              <span className="text-sm text-muted-foreground ml-2">
                {entry.document_type} · {format(new Date(entry.document_date), "dd MMM yyyy", { locale: it })}
              </span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 pb-4">
            {/* Movement info */}
            <div className="p-3 rounded-lg bg-muted/50 border space-y-1.5">
              {entry.note && (
                <p className="text-sm">
                  <span className="text-xs text-muted-foreground">Soggetto: </span>
                  {entry.note}
                </p>
              )}
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {entry.payment_method && <Badge variant="outline" className="text-xs">{formatPaymentMethod(entry.payment_method)}</Badge>}
                {entry.status && <Badge variant="secondary" className="text-xs capitalize">{entry.status.replace(/_/g, " ")}</Badge>}
              </div>
              {entry.attachment_url && (
                <a href={entry.attachment_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1">
                  <Eye className="h-3 w-3" /> Vedi allegato
                </a>
              )}
            </div>

            {/* AI Button */}
            <Button variant="outline" className="w-full gap-2" onClick={handleAIClassify} disabled={isClassifying}>
              {isClassifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isClassifying ? "Classificazione in corso..." : "Classifica con AI"}
            </Button>

            <Separator />

            {/* IVA Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Importi e IVA</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Regime IVA</Label>
                  <Select value={form.iva_mode} onValueChange={v => {
                    const zeroIva = isZeroIvaMode(v);
                    const imp = form.imponibile;
                    const aliq = form.iva_aliquota;
                    const iva = zeroIva ? 0 : imp * (aliq / 100);
                    const tot = zeroIva ? imp : imp + iva;
                    setForm(p => ({ ...p, iva_mode: v, iva_amount: iva, totale: tot }));
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(IVA_MODE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Aliquota %</Label>
                  <Input type="number" value={form.iva_aliquota} onChange={e => {
                    const aliq = parseFloat(e.target.value) || 0;
                    const zeroIva = isZeroIvaMode(form.iva_mode);
                    const iva = zeroIva ? 0 : form.imponibile * (aliq / 100);
                    const tot = zeroIva ? form.imponibile : form.imponibile + iva;
                    setForm(p => ({ ...p, iva_aliquota: aliq, iva_amount: iva, totale: tot }));
                  }} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Imponibile</Label>
                  <Input type="number" step="0.01" value={form.imponibile} onChange={e => {
                    const imp = parseFloat(e.target.value) || 0;
                    const zeroIva = isZeroIvaMode(form.iva_mode);
                    const iva = zeroIva ? 0 : imp * (form.iva_aliquota / 100);
                    const tot = zeroIva ? imp : imp + iva;
                    setForm(p => ({ ...p, imponibile: imp, iva_amount: iva, totale: tot }));
                  }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">IVA</Label>
                  <Input type="number" step="0.01" value={form.iva_amount} readOnly className="bg-muted/50" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Totale</Label>
                  <Input type="number" step="0.01" value={form.totale} readOnly className="bg-muted/50 font-semibold" />
                </div>
              </div>
            </div>

            <Separator />

            {/* Classification */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Classificazione Contabile</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo Evento *</Label>
                  <Select value={form.event_type} onValueChange={v => setForm(p => ({ ...p, event_type: v }))}>
                    <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                    <SelectContent>
                      {eventTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Stato Finanziario</Label>
                  <Select value={form.financial_status} onValueChange={v => setForm(p => ({ ...p, financial_status: v }))}>
                    <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                    <SelectContent>
                      {financialStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded-md border bg-muted/30">
                <Label className="text-xs">Incide su Conto Economico</Label>
                <Switch
                  checked={form.affects_income_statement}
                  onCheckedChange={v => setForm(p => ({ ...p, affects_income_statement: v }))}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Conto (Piano dei Conti) *</Label>
                <Select value={form.chart_account_id} onValueChange={v => setForm(p => ({ ...p, chart_account_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleziona conto..." /></SelectTrigger>
                  <SelectContent>
                    {accounts.filter(a => !a.level || a.level >= 2).map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Centro di Costo</Label>
                  <Select value={form.cost_center_id || "none"} onValueChange={v => setForm(p => ({ ...p, cost_center_id: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuno</SelectItem>
                      {costCenters.map(cc => <SelectItem key={cc.id} value={cc.id}>{cc.code} - {cc.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Centro di Profitto</Label>
                  <Select value={form.profit_center_id || "none"} onValueChange={v => setForm(p => ({ ...p, profit_center_id: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuno</SelectItem>
                      {profitCenters.map(pc => <SelectItem key={pc.id} value={pc.id}>{pc.code} - {pc.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Competenza Temporale</Label>
                  <Select value={form.temporal_competence} onValueChange={v => setForm(p => ({ ...p, temporal_competence: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {temporalCompetences.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Metodo Pagamento</Label>
                  <Select value={form.payment_method || "none"} onValueChange={v => setForm(p => ({ ...p, payment_method: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Non specificato</SelectItem>
                      <SelectGroup>
                        <SelectLabel>Bancario</SelectLabel>
                        <SelectItem value="bonifico">Bonifico</SelectItem>
                        <SelectItem value="banca">Banca (altro)</SelectItem>
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel>Carte</SelectLabel>
                        <SelectItem value="carta">Carta</SelectItem>
                        <SelectItem value="american_express">American Express</SelectItem>
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel>Contante</SelectLabel>
                        <SelectItem value="contanti">Contanti</SelectItem>
                        <SelectItem value="cassa">Cassa</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {form.temporal_competence === "rateizzata" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Da</Label>
                    <Input type="date" value={form.recurrence_start_date} onChange={e => setForm(p => ({ ...p, recurrence_start_date: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">A</Label>
                    <Input type="date" value={form.recurrence_end_date} onChange={e => setForm(p => ({ ...p, recurrence_end_date: e.target.value }))} />
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-xs">Note CFO</Label>
              <Textarea
                value={form.cfo_notes}
                onChange={e => setForm(p => ({ ...p, cfo_notes: e.target.value }))}
                placeholder="Note aggiuntive..."
                rows={2}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 gap-2 pt-4 border-t">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive mr-auto">
                <Trash2 className="h-4 w-4 mr-1" />
                Elimina
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Elimina bozza?</AlertDialogTitle>
                <AlertDialogDescription>Questa azione è irreversibile.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate()}>Elimina</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button variant="outline" onClick={() => saveDraftMutation.mutate()} disabled={saveDraftMutation.isPending}>
            Salva Bozza
          </Button>
          <Button
            onClick={() => validateAndGenerateMutation.mutate()}
            disabled={!canValidate || validateAndGenerateMutation.isPending}
            className="gap-2"
          >
            {validateAndGenerateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            Valida e Contabilizza
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
