import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Pencil, Save, X, Clock, User, Building2 } from "lucide-react";
import { formatEuro } from "@/lib/accounting-utils";
import { cn } from "@/lib/utils";
import { LinkedDocumentsSection } from "./LinkedDocumentsSection";
import { CustomerSearchSelect } from "./CustomerSearchSelect";

const FINANCIAL_ACCOUNTS: Record<string, string> = {
  banca: "🏦 Banca",
  cassa: "💵 Cassa",
  carta: "💳 Carta",
  american_express: "💳 American Express",
  contanti: "🪙 Contanti",
};

interface Props {
  entryId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrimaNotaDetailDialog({ entryId, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Fetch full entry
  const { data: entry, isLoading } = useQuery({
    queryKey: ["prima-nota-detail", entryId],
    queryFn: async () => {
      if (!entryId) return null;
      const { data, error } = await supabase
        .from("accounting_entries")
        .select("*, cost_centers(name, code), profit_centers(name, code), chart_of_accounts(name, code)")
        .eq("id", entryId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!entryId && open,
  });

  // Fetch linked customer name
  const { data: linkedCustomer } = useQuery({
    queryKey: ["customer-name", entry?.economic_subject_id],
    queryFn: async () => {
      if (!entry?.economic_subject_id) return null;
      const { data } = await supabase
        .from("customers")
        .select("id, name, company_name")
        .eq("id", entry.economic_subject_id)
        .single();
      return data;
    },
    enabled: !!entry?.economic_subject_id,
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["audit-logs", entryId],
    queryFn: async () => {
      if (!entryId) return [];
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("table_name", "accounting_entries")
        .eq("record_id", entryId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!entryId && open,
  });

  // Populate form when entry loads
  useEffect(() => {
    if (entry) {
      setFormData({
        document_date: entry.document_date,
        direction: entry.direction,
        amount: entry.amount,
        note: entry.note || "",
        payment_method: entry.payment_method || "",
        cfo_notes: entry.cfo_notes || "",
        imponibile: entry.imponibile || "",
        iva_aliquota: entry.iva_aliquota || "",
        iva_amount: entry.iva_amount || "",
        totale: entry.totale || "",
        economic_subject_id: entry.economic_subject_id || "",
        economic_subject_type: entry.economic_subject_type || "",
      });
      setEditing(false);
    }
  }, [entry]);

  // Update mutation with audit log
  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { data: user } = await supabase.auth.getUser();

      // Build old/new values for audit
      const oldValues: Record<string, any> = {};
      const newValues: Record<string, any> = {};
      for (const key of Object.keys(updates)) {
        if (entry && (entry as any)[key] !== updates[key]) {
          oldValues[key] = (entry as any)[key];
          newValues[key] = updates[key];
        }
      }

      if (Object.keys(newValues).length === 0) {
        throw new Error("Nessuna modifica rilevata");
      }

      // Update entry
      const { error } = await supabase
        .from("accounting_entries")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", entryId!);
      if (error) throw error;

      // Insert audit log
      const { error: auditError } = await supabase
        .from("audit_logs")
        .insert({
          table_name: "accounting_entries",
          record_id: entryId!,
          action: "update",
          old_values: oldValues,
          new_values: newValues,
          user_id: user?.user?.id || null,
        });
      if (auditError) console.error("Audit log error:", auditError);
    },
    onSuccess: () => {
      toast.success("Movimento aggiornato");
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["prima-nota-detail", entryId] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs", entryId] });
      queryClient.invalidateQueries({ queryKey: ["prima-nota-movements"] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSave = () => {
    const updates: Record<string, any> = {};
    if (formData.document_date !== entry?.document_date) updates.document_date = formData.document_date;
    if (formData.direction !== entry?.direction) updates.direction = formData.direction;
    if (Number(formData.amount) !== Number(entry?.amount)) updates.amount = Number(formData.amount);
    if (formData.note !== (entry?.note || "")) updates.note = formData.note;
    if (formData.payment_method !== (entry?.payment_method || "")) updates.payment_method = formData.payment_method;
    if (formData.cfo_notes !== (entry?.cfo_notes || "")) updates.cfo_notes = formData.cfo_notes;
    if (formData.imponibile !== "" && Number(formData.imponibile) !== Number(entry?.imponibile || 0)) updates.imponibile = Number(formData.imponibile);
    if (formData.iva_aliquota !== "" && Number(formData.iva_aliquota) !== Number(entry?.iva_aliquota || 0)) updates.iva_aliquota = Number(formData.iva_aliquota);
    if (formData.iva_amount !== "" && Number(formData.iva_amount) !== Number(entry?.iva_amount || 0)) updates.iva_amount = Number(formData.iva_amount);
    if (formData.totale !== "" && Number(formData.totale) !== Number(entry?.totale || 0)) updates.totale = Number(formData.totale);
    if (formData.economic_subject_id !== (entry?.economic_subject_id || "")) updates.economic_subject_id = formData.economic_subject_id || null;
    if (formData.economic_subject_type !== (entry?.economic_subject_type || "")) updates.economic_subject_type = formData.economic_subject_type || null;

    if (Object.keys(updates).length === 0) {
      toast.info("Nessuna modifica rilevata");
      return;
    }
    updateMutation.mutate(updates);
  };

  const FIELD_LABELS: Record<string, string> = {
    document_date: "Data",
    direction: "Direzione",
    amount: "Importo",
    note: "Descrizione",
    payment_method: "Metodo Pagamento",
    cfo_notes: "Note CFO",
    imponibile: "Imponibile",
    iva_aliquota: "Aliquota IVA",
    iva_amount: "Importo IVA",
    totale: "Totale",
    status: "Stato",
    account_code: "Codice",
  };

  const formatFieldValue = (key: string, value: any): string => {
    if (value === null || value === undefined || value === "") return "—";
    if (key === "document_date") return format(new Date(value), "dd/MM/yyyy", { locale: it });
    if (key === "direction") return value === "entrata" ? "Entrata" : "Uscita";
    if (key === "payment_method") return FINANCIAL_ACCOUNTS[value] || value;
    if (["amount", "imponibile", "iva_amount", "totale"].includes(key)) return formatEuro(Number(value));
    if (key === "iva_aliquota") return `${value}%`;
    return String(value);
  };

  if (!entryId) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setEditing(false); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <DialogHeader className="p-0">
            <DialogTitle className="text-lg">
              Dettaglio Movimento
              {entry?.account_code && (
                <code className="ml-2 text-xs font-mono bg-muted px-2 py-0.5 rounded">{entry.account_code}</code>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2">
            {!editing ? (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Modifica
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => { setEditing(false); if (entry) setFormData({ document_date: entry.document_date, direction: entry.direction, amount: entry.amount, note: entry.note || "", payment_method: entry.payment_method || "", cfo_notes: entry.cfo_notes || "", imponibile: entry.imponibile || "", iva_aliquota: entry.iva_aliquota || "", iva_amount: entry.iva_amount || "", totale: entry.totale || "", economic_subject_id: entry.economic_subject_id || "", economic_subject_type: entry.economic_subject_type || "" }); }}>
                  <X className="h-3.5 w-3.5 mr-1" /> Annulla
                </Button>
                <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  Salva
                </Button>
              </>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 overflow-auto">
          <div className="p-6 space-y-6">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Caricamento...</div>
            ) : entry ? (
              <>
                {/* Main fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Data</Label>
                    {editing ? (
                      <Input type="date" value={formData.document_date} onChange={(e) => setFormData(p => ({ ...p, document_date: e.target.value }))} />
                    ) : (
                      <p className="font-medium">{format(new Date(entry.document_date), "dd MMMM yyyy", { locale: it })}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Direzione</Label>
                    {editing ? (
                      <Select value={formData.direction} onValueChange={(v) => setFormData(p => ({ ...p, direction: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="entrata">Entrata</SelectItem>
                          <SelectItem value="uscita">Uscita</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className={cn(
                        entry.direction === "entrata" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                      )}>
                        {entry.direction === "entrata" ? "Entrata" : "Uscita"}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Amount section */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Importo</Label>
                  {editing ? (
                    <Input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData(p => ({ ...p, amount: e.target.value }))} className="text-lg font-bold" />
                  ) : (
                    <p className={cn("text-2xl font-bold", entry.direction === "entrata" ? "text-emerald-600" : "text-red-600")}>
                      {entry.direction === "entrata" ? "+" : "−"} {formatEuro(entry.amount, { absolute: true })}
                    </p>
                  )}
                </div>

                {/* IVA breakdown */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Imponibile</Label>
                    {editing ? (
                      <Input type="number" step="0.01" value={formData.imponibile} onChange={(e) => setFormData(p => ({ ...p, imponibile: e.target.value }))} />
                    ) : (
                      <p className="font-semibold">{entry.imponibile ? formatEuro(Number(entry.imponibile)) : "—"}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">IVA ({editing ? (
                      <Input type="number" step="0.01" value={formData.iva_aliquota} onChange={(e) => setFormData(p => ({ ...p, iva_aliquota: e.target.value }))} className="inline w-16 h-6 text-xs" />
                    ) : (
                      <span>{entry.iva_aliquota || 0}%</span>
                    )})</Label>
                    {editing ? (
                      <Input type="number" step="0.01" value={formData.iva_amount} onChange={(e) => setFormData(p => ({ ...p, iva_amount: e.target.value }))} />
                    ) : (
                      <p className="font-semibold">{entry.iva_amount ? formatEuro(Number(entry.iva_amount)) : "—"}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Totale</Label>
                    {editing ? (
                      <Input type="number" step="0.01" value={formData.totale} onChange={(e) => setFormData(p => ({ ...p, totale: e.target.value }))} />
                    ) : (
                      <p className="font-bold text-lg">{entry.totale ? formatEuro(Number(entry.totale)) : "—"}</p>
                    )}
                  </div>
                </div>

                {/* Cliente / Fornitore */}
                <div className="space-y-1.5">
                  {editing ? (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <button
                          type="button"
                          onClick={() => setFormData(p => ({ ...p, economic_subject_type: 'cliente' }))}
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-medium transition-all",
                            formData.economic_subject_type === 'cliente'
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                              : "bg-muted/50 text-muted-foreground hover:bg-muted"
                          )}
                        >
                          Cliente
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData(p => ({ ...p, economic_subject_type: 'fornitore' }))}
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-medium transition-all",
                            formData.economic_subject_type === 'fornitore'
                              ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400"
                              : "bg-muted/50 text-muted-foreground hover:bg-muted"
                          )}
                        >
                          Fornitore
                        </button>
                      </div>
                      <CustomerSearchSelect
                        selectedCustomerId={formData.economic_subject_id || ""}
                        onSelect={(id, name) => setFormData(p => ({
                          ...p,
                          economic_subject_id: id,
                          economic_subject_type: id ? (p.economic_subject_type || "cliente") : "",
                        }))}
                        label={formData.economic_subject_type === 'fornitore' ? 'Fornitore' : 'Cliente'}
                      />
                    </>
                  ) : (
                    <>
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                        {entry?.economic_subject_type === 'fornitore' ? 'Fornitore' : entry?.economic_subject_type === 'cliente' ? 'Cliente' : 'Soggetto Economico'}
                      </Label>
                      {linkedCustomer ? (
                        <div className="flex items-center gap-2.5 p-2.5 rounded-lg border bg-muted/20">
                          <div className={cn(
                            "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                            entry?.economic_subject_type === 'fornitore' ? "bg-orange-100 dark:bg-orange-950/30" : "bg-primary/10"
                          )}>
                            <Building2 className={cn("h-4 w-4", entry?.economic_subject_type === 'fornitore' ? "text-orange-600" : "text-primary")} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate">{linkedCustomer.company_name || linkedCustomer.name}</p>
                            <div className="flex items-center gap-1.5">
                              {linkedCustomer.company_name && (
                                <p className="text-xs text-muted-foreground truncate">{linkedCustomer.name}</p>
                              )}
                              <Badge variant="outline" className={cn(
                                "text-[9px] px-1 py-0",
                                entry?.economic_subject_type === 'fornitore'
                                  ? "border-orange-200 text-orange-700"
                                  : "border-blue-200 text-blue-700"
                              )}>
                                {entry?.economic_subject_type === 'fornitore' ? 'Fornitore' : 'Cliente'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Nessun soggetto associato</p>
                      )}
                    </>
                  )}
                </div>

                {/* Conto finanziario */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Conto Finanziario</Label>
                  {editing ? (
                    <Select value={formData.payment_method} onValueChange={(v) => setFormData(p => ({ ...p, payment_method: v }))}>
                      <SelectTrigger><SelectValue placeholder="Seleziona conto" /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(FINANCIAL_ACCOUNTS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium">{FINANCIAL_ACCOUNTS[entry.payment_method || ""] || entry.payment_method || "—"}</p>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Descrizione</Label>
                  {editing ? (
                    <Textarea value={formData.note} onChange={(e) => setFormData(p => ({ ...p, note: e.target.value }))} rows={2} />
                  ) : (
                    <p className="text-sm">{entry.note || "—"}</p>
                  )}
                </div>

                {/* CFO Notes */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Note CFO</Label>
                  {editing ? (
                    <Textarea value={formData.cfo_notes} onChange={(e) => setFormData(p => ({ ...p, cfo_notes: e.target.value }))} rows={2} />
                  ) : (
                    <p className="text-sm">{entry.cfo_notes || "—"}</p>
                  )}
                </div>

                {/* Classification data */}
                {(entry.cost_center_id || entry.profit_center_id || entry.chart_account_id || entry.event_type || entry.iva_mode || entry.affects_income_statement !== null) && (
                  <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Classificazione Contabile</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {(entry as any).cost_centers && (
                        <div className="space-y-0.5">
                          <Label className="text-xs text-muted-foreground">Centro di Costo</Label>
                          <p className="text-sm font-medium">{(entry as any).cost_centers.code} — {(entry as any).cost_centers.name}</p>
                        </div>
                      )}
                      {(entry as any).profit_centers && (
                        <div className="space-y-0.5">
                          <Label className="text-xs text-muted-foreground">Centro di Ricavo</Label>
                          <p className="text-sm font-medium">{(entry as any).profit_centers.code} — {(entry as any).profit_centers.name}</p>
                        </div>
                      )}
                      {(entry as any).chart_of_accounts && (
                        <div className="space-y-0.5">
                          <Label className="text-xs text-muted-foreground">Piano dei Conti</Label>
                          <p className="text-sm font-medium">{(entry as any).chart_of_accounts.code} — {(entry as any).chart_of_accounts.name}</p>
                        </div>
                      )}
                      {entry.event_type && (
                        <div className="space-y-0.5">
                          <Label className="text-xs text-muted-foreground">Tipo Evento</Label>
                          <p className="text-sm font-medium">{entry.event_type}</p>
                        </div>
                      )}
                      {entry.iva_mode && (
                        <div className="space-y-0.5">
                          <Label className="text-xs text-muted-foreground">Regime IVA</Label>
                          <p className="text-sm font-medium">{entry.iva_mode.replace(/_/g, ' ')}</p>
                        </div>
                      )}
                      {entry.affects_income_statement !== null && (
                        <div className="space-y-0.5">
                          <Label className="text-xs text-muted-foreground">Incide su CE</Label>
                          <Badge variant={entry.affects_income_statement ? "default" : "secondary"}>
                            {entry.affects_income_statement ? "Sì" : "No"}
                          </Badge>
                        </div>
                      )}
                      {entry.temporal_competence && (
                        <div className="space-y-0.5">
                          <Label className="text-xs text-muted-foreground">Competenza Temporale</Label>
                          <p className="text-sm font-medium">{entry.temporal_competence}</p>
                        </div>
                      )}
                      {entry.center_percentage && (
                        <div className="space-y-0.5">
                          <Label className="text-xs text-muted-foreground">% Centro</Label>
                          <p className="text-sm font-medium">{entry.center_percentage}%</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Status + metadata */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Stato</Label>
                    <div className="mt-1">
                      <Badge variant={entry.status === "registrato" || entry.status === "classificato" ? "default" : "secondary"}>
                        {entry.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">Creato il</Label>
                    <p className="font-medium">{format(new Date(entry.created_at), "dd/MM/yyyy HH:mm", { locale: it })}</p>
                  </div>
                </div>

                {/* Linked Documents */}
                <Separator />
                <LinkedDocumentsSection entryId={entry.id} editing={editing} />

                {/* Audit Log Section */}
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Cronologia Modifiche
                  </h3>
                  {auditLogs.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Nessuna modifica registrata</p>
                  ) : (
                    <div className="space-y-2">
                      {auditLogs.map((log) => (
                        <div key={log.id} className="rounded-lg border bg-muted/20 p-3 space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {log.action === "update" ? "Modifica" : log.action}
                            </span>
                            <span>{format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: it })}</span>
                          </div>
                          {log.old_values && log.new_values && (
                            <div className="space-y-1">
                              {Object.keys(log.new_values as Record<string, any>).map((key) => (
                                <div key={key} className="text-xs flex items-center gap-2">
                                  <span className="font-medium text-muted-foreground min-w-[100px]">
                                    {FIELD_LABELS[key] || key}:
                                  </span>
                                  <span className="line-through text-red-500/70">
                                    {formatFieldValue(key, (log.old_values as Record<string, any>)[key])}
                                  </span>
                                  <span className="text-muted-foreground">→</span>
                                  <span className="text-emerald-600 font-medium">
                                    {formatFieldValue(key, (log.new_values as Record<string, any>)[key])}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
