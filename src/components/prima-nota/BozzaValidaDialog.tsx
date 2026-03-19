import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  ArrowUp, ArrowDown, CheckCircle, Loader2,
  Eye, Trash2
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CustomerSearchSelect } from "./CustomerSearchSelect";
import { LinkedDocumentsSection } from "./LinkedDocumentsSection";
import { cn } from "@/lib/utils";

import { isZeroIvaMode, normalizeIvaMode, formatPaymentMethod, generateDoubleEntryLines } from "@/lib/accounting-utils";

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
// COMPONENT
// =====================================================

export function BozzaValidaDialog({ open, onOpenChange, entry }: BozzaValidaDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    financial_account: "banca",
    economic_subject_id: "",
    economic_subject_type: "cliente" as string,
    description: "",
    iva_mode: "ORDINARIO_22",
    iva_aliquota: 22,
    imponibile: 0,
    iva_amount: 0,
    totale: 0,
    cfo_notes: "",
    amount: 0,
    date: "",
    type: "entrata" as string,
  });

  // Populate form from entry when opened
  useEffect(() => {
    if (entry && open) {
      // Map payment_method to financial_account
      const financialAccount = entry.payment_method || "banca";
      
      setForm({
        financial_account: financialAccount,
        economic_subject_id: entry.economic_subject_id || "",
        economic_subject_type: entry.economic_subject_type || (entry.direction === "entrata" ? "cliente" : "fornitore"),
        description: entry.note || "",
        iva_mode: normalizeIvaMode(entry.iva_mode),
        iva_aliquota: entry.iva_aliquota ?? (isZeroIvaMode(normalizeIvaMode(entry.iva_mode)) ? 0 : 22),
        imponibile: entry.imponibile || entry.amount || 0,
        iva_amount: entry.iva_amount ?? 0,
        totale: entry.totale || entry.amount || 0,
        cfo_notes: entry.cfo_notes || "",
        amount: entry.amount || 0,
        date: entry.document_date || "",
        type: entry.direction || "entrata",
      });
    }
  }, [entry, open]);

  // Save & register as Prima Nota movement (same logic as manual entry)
  const registerMutation = useMutation({
    mutationFn: async () => {
      if (!entry) throw new Error("No entry");

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const ivaMode = form.iva_mode || "ORDINARIO_22";
      const ivaAliquota = form.iva_aliquota || 22;
      const imponibile = form.imponibile || form.amount;
      const ivaAmount = form.iva_amount || 0;
      const totale = form.totale || form.amount;
      const isRevenue = form.type === "entrata";
      const paymentMethod = form.financial_account || "banca";

      // 1. Update accounting_entry
      const { error: updateError } = await supabase
        .from("accounting_entries")
        .update({
          direction: form.type,
          payment_method: paymentMethod,
          note: form.description || null,
          iva_mode: ivaMode,
          iva_aliquota: ivaAliquota,
          imponibile,
          iva_amount: ivaAmount,
          totale,
          amount: totale,
          economic_subject_id: form.economic_subject_id || null,
          economic_subject_type: form.economic_subject_type || null,
          cfo_notes: form.cfo_notes || null,
          classified_by: userId,
          classified_at: new Date().toISOString(),
          status: "registrato",
          financial_status: isRevenue ? "incassato" : "pagato",
          event_type: isRevenue ? "ricavo" : "costo",
          affects_income_statement: true,
        })
        .eq("id", entry.id);

      if (updateError) throw updateError;

      // 2. Generate Prima Nota movement
      const movementId = crypto.randomUUID();
      const description = form.description || `${isRevenue ? "Entrata" : "Uscita"} registrata`;

      const movement = {
        id: movementId,
        accounting_entry_id: entry.id,
        movement_type: "economico",
        competence_date: form.date || entry.document_date,
        amount: isRevenue ? totale : -totale,
        description,
        status: "registrato",
        is_rectification: false,
        iva_mode: ivaMode,
        iva_aliquota: ivaAliquota,
        imponibile,
        iva_amount: ivaAmount,
        totale,
        payment_method: paymentMethod,
        created_by: userId,
      };

      const lines = generateDoubleEntryLines(
        movementId, isRevenue, true, ivaMode, ivaAliquota,
        imponibile, ivaAmount, totale, paymentMethod, null
      );

      const { error: insertError } = await supabase.from("prima_nota").insert([movement]);
      if (insertError) throw insertError;
      if (lines.length > 0) {
        const { error: linesError } = await supabase.from("prima_nota_lines").insert(lines);
        if (linesError) throw linesError;
      }

      return 1;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prima-nota"] });
      queryClient.invalidateQueries({ queryKey: ["prima-nota-movements"] });
      queryClient.invalidateQueries({ queryKey: ["pending-prima-nota-entries"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-entries-to-classify"] });
      queryClient.invalidateQueries({ queryKey: ["bozze-prima-nota"] });
      toast.success("Segnalazione registrata come movimento");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error("Errore: " + (err.message || "Errore nella registrazione"));
    },
  });

  // Save as draft
  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      if (!entry) throw new Error("No entry");
      const { error } = await supabase
        .from("accounting_entries")
        .update({
          direction: form.type,
          payment_method: form.financial_account || null,
          note: form.description || null,
          iva_mode: form.iva_mode,
          iva_aliquota: form.iva_aliquota,
          imponibile: form.imponibile,
          iva_amount: form.iva_amount,
          totale: form.totale,
          amount: form.totale || form.amount,
          economic_subject_id: form.economic_subject_id || null,
          economic_subject_type: form.economic_subject_type || null,
          cfo_notes: form.cfo_notes || null,
          status: "in_classificazione",
        })
        .eq("id", entry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bozze-prima-nota"] });
      queryClient.invalidateQueries({ queryKey: ["prima-nota-movements"] });
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

  const isEntrata = form.type === "entrata";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${isEntrata ? "bg-green-100 text-green-600 dark:bg-green-900/30" : "bg-red-100 text-red-600 dark:bg-red-900/30"}`}>
              {isEntrata ? <ArrowUp className="h-5 w-5" /> : <ArrowDown className="h-5 w-5" />}
            </div>
            <div>
              <span className="text-xl">€ {(form.totale || form.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
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

            {/* Amount */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Importo (Totale documento)</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground/50">€</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount || ''}
                  onChange={(e) => {
                    const tot = parseFloat(e.target.value) || 0;
                    const aliq = form.iva_aliquota || 0;
                    const imp = aliq > 0 ? Math.round((tot / (1 + aliq / 100)) * 100) / 100 : tot;
                    const iva = Math.round((tot - imp) * 100) / 100;
                    setForm(prev => ({ ...prev, amount: tot, totale: tot, imponibile: imp, iva_amount: iva }));
                  }}
                  placeholder="0,00"
                  className="pl-12 h-14 text-2xl font-bold tabular-nums border-2 focus:border-primary"
                />
              </div>
            </div>

            {/* Date + Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Data</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value }))}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm(prev => ({ ...prev, type: v }))}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrata">↑ Entrata</SelectItem>
                    <SelectItem value="uscita">↓ Uscita</SelectItem>
                    <SelectItem value="movimento_interno">↔ Mov. Interno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Financial account — visual cards */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Conto finanziario</Label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { key: 'banca', label: 'Banca', icon: '🏦' },
                  { key: 'cassa', label: 'Cassa', icon: '💵' },
                  { key: 'carta', label: 'Carta', icon: '💳' },
                  { key: 'american_express', label: 'Amex', icon: '💳' },
                  { key: 'contanti', label: 'Contanti', icon: '🪙' },
                ].map(acc => (
                  <button
                    key={acc.key}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, financial_account: acc.key }))}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border-2 p-2.5 text-xs font-medium transition-all",
                      form.financial_account === acc.key
                        ? "border-primary bg-primary/5 text-primary shadow-sm"
                        : "border-transparent bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:border-muted"
                    )}
                  >
                    <span className="text-lg">{acc.icon}</span>
                    <span>{acc.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Cliente / Fornitore */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  {form.type === 'entrata' ? 'Cliente' : 'Fornitore'}
                </Label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, economic_subject_type: 'cliente' }))}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-medium transition-all",
                      form.economic_subject_type === 'cliente'
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    Cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, economic_subject_type: 'fornitore' }))}
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-medium transition-all",
                      form.economic_subject_type === 'fornitore'
                        ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    Fornitore
                  </button>
                </div>
              </div>
              <CustomerSearchSelect
                selectedCustomerId={form.economic_subject_id}
                onSelect={(id, name) => setForm(prev => ({
                  ...prev,
                  economic_subject_id: id,
                  economic_subject_type: id ? (prev.economic_subject_type || (prev.type === 'entrata' ? 'cliente' : 'fornitore')) : '',
                }))}
                label={form.economic_subject_type === 'fornitore' ? 'Fornitore' : 'Cliente'}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Descrizione</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Es: Pagamento fattura fornitore XYZ..."
                rows={2}
                className="resize-none"
              />
            </div>

            {/* IVA Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Regime IVA</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Regime IVA</Label>
                  <Select value={form.iva_mode} onValueChange={v => {
                    const zeroIva = isZeroIvaMode(v);
                    const newAliq = zeroIva ? 0 : 22;
                    const tot = form.totale || form.amount;
                    const imp = zeroIva ? tot : Math.round((tot / (1 + newAliq / 100)) * 100) / 100;
                    const iva = zeroIva ? 0 : Math.round((tot - imp) * 100) / 100;
                    setForm(p => ({ ...p, iva_mode: v, iva_aliquota: newAliq, imponibile: imp, iva_amount: iva }));
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ORDINARIO_22">Ordinario (22%)</SelectItem>
                      <SelectItem value="REVERSE_CHARGE">Reverse Charge (0%)</SelectItem>
                      <SelectItem value="INTRA_UE">Intra UE (0%)</SelectItem>
                      <SelectItem value="EXTRA_UE">Extra UE (0%)</SelectItem>
                      <SelectItem value="ESENTE">Esente</SelectItem>
                      <SelectItem value="NON_SOGGETTO">Non soggetto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Aliquota %</Label>
                  <Input type="number" value={form.iva_aliquota} readOnly={isZeroIvaMode(form.iva_mode)} className={isZeroIvaMode(form.iva_mode) ? "bg-muted/50" : ""} onChange={e => {
                    const aliq = parseFloat(e.target.value) || 0;
                    const tot = form.totale || form.amount;
                    const imp = aliq > 0 ? Math.round((tot / (1 + aliq / 100)) * 100) / 100 : tot;
                    const iva = Math.round((tot - imp) * 100) / 100;
                    setForm(p => ({ ...p, iva_aliquota: aliq, imponibile: imp, iva_amount: iva }));
                  }} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Imponibile</Label>
                  <Input type="number" step="0.01" value={form.imponibile} readOnly className="bg-muted/50" />
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

            {/* Linked Operational Documents */}
            <LinkedDocumentsSection entryId={entry.id} editing={true} />

            <Separator />

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Note <span className="normal-case font-normal">(opzionale)</span></Label>
              <Input
                value={form.cfo_notes}
                onChange={e => setForm(p => ({ ...p, cfo_notes: e.target.value }))}
                placeholder="Note aggiuntive..."
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
            onClick={() => registerMutation.mutate()}
            disabled={!form.financial_account || !form.amount || registerMutation.isPending}
            className="gap-2"
          >
            {registerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            Valida e Contabilizza
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
