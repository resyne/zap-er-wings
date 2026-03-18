import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  ShoppingCart, Package, FileText, Receipt, Clock, User,
  Building2, AlertTriangle, FileCheck, ArrowUpRight, Wrench,
  Truck, Calendar, CheckCircle2, CircleDot, BookOpen
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    number: string;
    order_date: string | null;
    customer_id: string | null;
    total_amount: number | null;
    status: string | null;
    order_type: string | null;
    invoiced: boolean | null;
    invoice_number: string | null;
    accounting_document_id: string | null;
    non_contabilizzato: boolean;
    order_source: string | null;
  } | null;
  customerName: string;
}

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: "Bozza", color: "bg-muted text-muted-foreground" },
  confirmed: { label: "Confermato", color: "bg-primary/10 text-primary" },
  in_progress: { label: "In Lavorazione", color: "bg-amber-500/10 text-amber-700" },
  completed: { label: "Completato", color: "bg-emerald-500/10 text-emerald-700" },
  completato: { label: "Completato", color: "bg-emerald-500/10 text-emerald-700" },
  cancelled: { label: "Annullato", color: "bg-destructive/10 text-destructive" },
  commissionato: { label: "Commissionato", color: "bg-blue-500/10 text-blue-700" },
  in_lavorazione: { label: "In Lavorazione", color: "bg-amber-500/10 text-amber-700" },
};

const typeMap: Record<string, string> = {
  odp: "Produzione",
  odpel: "Prod. + Installazione",
  odl: "Intervento",
  ods: "Spedizione",
};

const phaseIcons: Record<string, typeof Package> = {
  produzione: Package,
  spedizione: Truck,
  installazione: Wrench,
  manutenzione: Wrench,
};

export function OrderDetailSheet({ open, onOpenChange, order, customerName }: Props) {
  const orderId = order?.id;

  // Fetch commesse
  const { data: commesse = [] } = useQuery({
    queryKey: ["order-commesse", orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from("commesse")
        .select("id, number, title, status, type, created_at, deadline, assigned_to")
        .eq("sales_order_id", orderId!)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!orderId && open,
  });

  // Fetch phases for commesse
  const commessaIds = commesse.map(c => c.id);
  const { data: phases = [] } = useQuery({
    queryKey: ["order-commessa-phases", commessaIds],
    queryFn: async () => {
      if (commessaIds.length === 0) return [];
      const { data } = await supabase
        .from("commessa_phases")
        .select("id, commessa_id, phase_type, phase_order, status, scheduled_date, completed_date, assigned_to")
        .in("commessa_id", commessaIds)
        .order("phase_order", { ascending: true });
      return data || [];
    },
    enabled: commessaIds.length > 0 && open,
  });

  // Fetch linked offer
  const { data: linkedOffer } = useQuery({
    queryKey: ["order-offer", orderId],
    queryFn: async () => {
      const { data: orderData } = await supabase
        .from("sales_orders")
        .select("offer_id")
        .eq("id", orderId!)
        .single();
      if (!orderData?.offer_id) return null;
      const { data } = await supabase
        .from("offers")
        .select("id, number, title, amount, status, customer_name")
        .eq("id", orderData.offer_id)
        .single();
      return data;
    },
    enabled: !!orderId && open,
  });

  // Fetch linked accounting document
  const { data: accountingDoc } = useQuery({
    queryKey: ["order-accounting-doc", order?.accounting_document_id],
    queryFn: async () => {
      if (!order?.accounting_document_id) return null;
      const { data } = await supabase
        .from("invoice_registry")
        .select("id, invoice_number, invoice_date, invoice_type, subject_name, total_amount, status, financial_status, prima_nota_id")
        .eq("id", order.accounting_document_id)
        .single();
      return data;
    },
    enabled: !!order?.accounting_document_id && open,
  });

  // Fetch prima nota movements linked to this invoice
  const { data: primaNotaMovements = [] } = useQuery({
    queryKey: ["order-prima-nota", accountingDoc?.prima_nota_id],
    queryFn: async () => {
      if (!accountingDoc?.prima_nota_id) return [];
      const { data } = await supabase
        .from("prima_nota")
        .select("id, numero_registrazione, data_registrazione, descrizione, totale_dare, totale_avere, stato")
        .eq("id", accountingDoc.prima_nota_id);
      return data || [];
    },
    enabled: !!accountingDoc?.prima_nota_id && open,
  });

  // Fetch source invoice_registry entries that reference this order
  const { data: registryEntries = [] } = useQuery({
    queryKey: ["order-registry-entries", orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoice_registry")
        .select("id, invoice_number, invoice_date, invoice_type, subject_name, total_amount, status, financial_status")
        .eq("source_document_id", orderId!)
        .eq("source_document_type", "sales_order");
      return data || [];
    },
    enabled: !!orderId && open,
  });

  // Fetch order logs
  const { data: logs = [] } = useQuery({
    queryKey: ["order-logs", orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales_order_logs")
        .select("id, action, details, created_at, user_id")
        .eq("sales_order_id", orderId!)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!orderId && open,
  });

  // Fetch user profiles for logs
  const logUserIds = [...new Set(logs.map(l => l.user_id).filter(Boolean))];
  const { data: logUsers = [] } = useQuery({
    queryKey: ["log-users", logUserIds],
    queryFn: async () => {
      if (logUserIds.length === 0) return [];
      const { data } = await supabase.from("profiles").select("id, first_name, last_name, email").in("id", logUserIds);
      return data || [];
    },
    enabled: logUserIds.length > 0 && open,
  });

  const userMap = new Map(logUsers.map(u => [u.id, `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email]));

  if (!order) return null;

  const st = statusMap[order.status || ""] || { label: order.status || "—", color: "bg-muted text-muted-foreground" };
  const allRegistryDocs = [
    ...(accountingDoc ? [accountingDoc] : []),
    ...registryEntries.filter(e => e.id !== accountingDoc?.id),
  ];
  const hasAccountingIssue = !order.invoiced && !order.non_contabilizzato && allRegistryDocs.length === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-5 pb-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="text-lg font-bold font-mono">{order.number}</SheetTitle>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge className={`text-xs ${st.color} border-0`}>{st.label}</Badge>
                <Badge variant="outline" className="text-xs">{typeMap[order.order_type || ""] || order.order_type || "—"}</Badge>
                <Badge variant="outline" className="text-xs">{order.order_source === "z-app" ? "Z-APP" : "ERP"}</Badge>
              </div>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-5 pb-5">
          <div className="space-y-5 pt-4">
            {/* Alert contabilità */}
            {hasAccountingIssue && (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <p className="text-sm text-amber-700 font-medium">Nessun documento contabile collegato</p>
              </div>
            )}

            {/* Info generali */}
            <div className="grid grid-cols-2 gap-3">
              <InfoItem icon={Building2} label="Cliente" value={customerName} />
              <InfoItem icon={Calendar} label="Data ordine" value={order.order_date ? format(new Date(order.order_date), "dd/MM/yyyy", { locale: it }) : "—"} />
              <InfoItem icon={Receipt} label="Importo" value={order.total_amount != null ? `€ ${order.total_amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "—"} />
              <InfoItem icon={ShoppingCart} label="Origine" value={order.order_source === "z-app" ? "Z-APP" : "ERP"} />
            </div>

            <Separator />

            {/* Offerta collegata */}
            {linkedOffer && (
              <>
                <SectionTitle icon={FileText} title="Offerta collegata" />
                <Card className="border">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{linkedOffer.title || linkedOffer.number}</p>
                      <p className="text-xs text-muted-foreground">{linkedOffer.customer_name} • € {linkedOffer.amount?.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>
                    </div>
                    <Badge variant={linkedOffer.status === "accepted" ? "default" : "secondary"} className="text-xs flex-shrink-0">
                      {linkedOffer.status === "accepted" ? "Accettata" : linkedOffer.status === "converted" ? "Convertita" : linkedOffer.status}
                    </Badge>
                  </CardContent>
                </Card>
                <Separator />
              </>
            )}

            {/* Commesse */}
            <SectionTitle icon={Package} title="Commesse" count={commesse.length} />
            {commesse.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna commessa collegata</p>
            ) : (
              <div className="space-y-2.5">
                {commesse.map(c => {
                  const cPhases = phases.filter(p => p.commessa_id === c.id);
                  const cStatus = statusMap[c.status] || { label: c.status, color: "bg-muted text-muted-foreground" };
                  return (
                    <Card key={c.id} className="border">
                      <CardContent className="p-3 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium font-mono">{c.number}</p>
                            <p className="text-xs text-muted-foreground truncate">{c.title}</p>
                          </div>
                          <Badge className={`text-xs ${cStatus.color} border-0 flex-shrink-0`}>{cStatus.label}</Badge>
                        </div>
                        {cPhases.length > 0 && (
                          <div className="space-y-1.5 pl-1">
                            {cPhases.map(phase => {
                              const PhaseIcon = phaseIcons[phase.phase_type] || CircleDot;
                              const isDone = phase.status === "completata" || phase.status === "completed";
                              return (
                                <div key={phase.id} className="flex items-center gap-2 text-xs">
                                  <PhaseIcon className={`h-3.5 w-3.5 flex-shrink-0 ${isDone ? "text-emerald-600" : "text-muted-foreground"}`} />
                                  <span className={`capitalize flex-1 ${isDone ? "text-emerald-700 line-through" : "text-foreground"}`}>{phase.phase_type}</span>
                                  {phase.completed_date && (
                                    <span className="text-muted-foreground">{format(new Date(phase.completed_date), "dd/MM", { locale: it })}</span>
                                  )}
                                  {isDone ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                  ) : (
                                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            <Separator />

            {/* Documenti Contabili */}
            <SectionTitle icon={Receipt} title="Documenti contabili" count={allRegistryDocs.length} />
            {allRegistryDocs.length === 0 ? (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed border-muted-foreground/30">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <p className="text-sm text-muted-foreground">Nessun documento contabile collegato</p>
              </div>
            ) : (
              <div className="space-y-2">
                {allRegistryDocs.map(doc => (
                  <Card key={doc.id} className="border">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <ArrowUpRight className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-medium">{doc.invoice_number}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {doc.invoice_type === "vendita" ? "Vendita" : doc.invoice_type === "acquisto" ? "Acquisto" : "N.C."}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{doc.subject_name} • {format(new Date(doc.invoice_date), "dd/MM/yyyy", { locale: it })}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold">€ {doc.total_amount?.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>
                        <Badge variant={doc.status === "contabilizzato" || doc.status === "registrata" ? "default" : "secondary"} className="text-[10px]">
                          {doc.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Prima Nota */}
            {primaNotaMovements.length > 0 && (
              <>
                <Separator />
                <SectionTitle icon={BookOpen} title="Movimenti Prima Nota" count={primaNotaMovements.length} />
                <div className="space-y-2">
                  {primaNotaMovements.map(mov => (
                    <Card key={mov.id} className="border">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-mono font-medium">{mov.numero_registrazione}</p>
                            <p className="text-xs text-muted-foreground truncate">{mov.descrizione}</p>
                          </div>
                          <Badge variant={mov.stato === "validato" ? "default" : "secondary"} className="text-xs flex-shrink-0">
                            {mov.stato}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{format(new Date(mov.data_registrazione), "dd/MM/yyyy", { locale: it })}</span>
                          {mov.totale_dare && <span>Dare: € {mov.totale_dare.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>}
                          {mov.totale_avere && <span>Avere: € {mov.totale_avere.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}

            {/* Cronologia */}
            {logs.length > 0 && (
              <>
                <Separator />
                <SectionTitle icon={Clock} title="Cronologia" count={logs.length} />
                <div className="space-y-1">
                  {logs.map(log => {
                    const details = log.details as any;
                    const changes = details?.changes || {};
                    return (
                      <div key={log.id} className="flex items-start gap-2.5 py-2 text-xs">
                        <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CircleDot className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{log.action === "created" ? "Creato" : "Aggiornato"}</span>
                            {changes.status && (
                              <span className="text-muted-foreground">
                                stato: {changes.status.old} → {changes.status.new}
                              </span>
                            )}
                          </div>
                          <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5">
                            <User className="h-3 w-3" />
                            {userMap.get(log.user_id) || "Sistema"}
                            <span>•</span>
                            {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: it })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function SectionTitle({ icon: Icon, title, count }: { icon: typeof Package; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <h3 className="text-sm font-semibold">{title}</h3>
      {count !== undefined && count > 0 && (
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{count}</Badge>
      )}
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: typeof Package; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/50">
      <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}
