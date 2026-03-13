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
import { Pencil, Save, X, Clock, User } from "lucide-react";
import { formatEuro } from "@/lib/accounting-utils";
import { cn } from "@/lib/utils";

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
        .select("*")
        .eq("id", entryId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!entryId && open,
  });

  // Fetch audit logs for this entry
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
                <Button variant="ghost" size="sm" onClick={() => { setEditing(false); if (entry) setFormData({ document_date: entry.document_date, direction: entry.direction, amount: entry.amount, note: entry.note || "", payment_method: entry.payment_method || "", cfo_notes: entry.cfo_notes || "", imponibile: entry.imponibile || "", iva_aliquota: entry.iva_aliquota || "", iva_amount: entry.iva_amount || "", totale: entry.totale || "" }); }}>
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
