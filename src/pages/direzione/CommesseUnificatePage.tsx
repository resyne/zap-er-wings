import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card } from "@/components/ui/card";
import {
  Search, Loader2, Wrench, Truck, Settings, MapPin, Package, Clock,
  ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Building2,
  CreditCard, Calendar, FileText, User
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────
interface UnifiedOrder {
  id: string;
  number: string;
  title: string;
  status: string;
  type: "produzione" | "servizio" | "spedizione";
  priority?: string;
  scheduled_date?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  location?: string;
  article?: string;
  customer_name?: string;
  customer_code?: string;
  created_at: string;
  description?: string;
  assigned_to_name?: string;
  notes?: string;
  shipping_address?: string;
  shipping_city?: string;
  shipping_country?: string;
  shipping_province?: string;
  shipping_postal_code?: string;
  equipment_needed?: string;
  estimated_hours?: number;
  actual_hours?: number;
  diameter?: string;
  smoke_inlet?: string;
  includes_installation?: boolean;
  payment_on_delivery?: boolean;
  payment_amount?: number;
  preparation_date?: string;
  shipped_date?: string;
  delivered_date?: string;
  lead_id?: string;
  bom_name?: string;
  bom_version?: string;
  sales_order_number?: string;
  sales_order_id?: string;
  offer_number?: string;
}

interface CustomerGroup {
  key: string;
  customerName: string;
  customerCode?: string;
  production: UnifiedOrder[];
  shipping: UnifiedOrder[];
  service: UnifiedOrder[];
  phases: { produzione: string; spedizione: string; servizio: string };
}

// ─── Constants ───────────────────────────────────────────────
const statusLabels: Record<string, { label: string; color: string }> = {
  da_fare: { label: "Da fare", color: "bg-amber-100 text-amber-700 border-amber-200" },
  planned: { label: "Pianificato", color: "bg-blue-100 text-blue-700 border-blue-200" },
  in_lavorazione: { label: "In lavorazione", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  in_test: { label: "In test", color: "bg-purple-100 text-purple-700 border-purple-200" },
  pronto: { label: "Pronto", color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  completato: { label: "Completato", color: "bg-green-100 text-green-700 border-green-200" },
  da_preparare: { label: "Da preparare", color: "bg-amber-100 text-amber-700 border-amber-200" },
  spedito: { label: "Spedito", color: "bg-green-100 text-green-700 border-green-200" },
  standby: { label: "Standby", color: "bg-gray-100 text-gray-600 border-gray-200" },
  bloccato: { label: "Bloccato", color: "bg-red-100 text-red-700 border-red-200" },
  in_progress: { label: "In corso", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  completed: { label: "Completato", color: "bg-green-100 text-green-700 border-green-200" },
};

const phaseConfig = {
  produzione: { label: "Produzione", icon: Settings, color: "bg-purple-500", lightBg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  spedizione: { label: "Spedizione", icon: Truck, color: "bg-amber-500", lightBg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  servizio: { label: "Installazione", icon: Wrench, color: "bg-blue-500", lightBg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
};

const statusFlowProduzione = [
  { value: "da_fare", label: "Da fare" },
  { value: "in_lavorazione", label: "In lavorazione" },
  { value: "in_test", label: "In test" },
  { value: "pronto", label: "Pronto" },
  { value: "standby", label: "Standby" },
  { value: "bloccato", label: "Bloccato" },
  { value: "completato", label: "Completato" },
];

const statusFlowServizio = [
  { value: "da_fare", label: "Da fare" },
  { value: "in_lavorazione", label: "In lavorazione" },
  { value: "in_test", label: "In test" },
  { value: "pronto", label: "Pronto" },
  { value: "standby", label: "Standby" },
  { value: "bloccato", label: "Bloccato" },
  { value: "completato", label: "Completato" },
];

const statusFlowSpedizione = [
  { value: "da_preparare", label: "Da preparare" },
  { value: "in_lavorazione", label: "In preparazione" },
  { value: "pronto", label: "Pronto" },
  { value: "spedito", label: "Spedito" },
];

const completedStatuses = ["completato", "spedito", "completed", "closed"];

const priorityLabels: Record<string, { label: string; color: string; icon?: boolean }> = {
  low: { label: "Bassa", color: "text-muted-foreground" },
  medium: { label: "Media", color: "text-amber-600" },
  high: { label: "Alta", color: "text-orange-600 font-semibold", icon: true },
  urgent: { label: "Urgente", color: "text-red-600 font-bold", icon: true },
};

// ─── Articles Checklist ──────────────────────────────────────
function ArticlesChecklist({ workOrderId }: { workOrderId: string }) {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("work_order_article_items").select("*").eq("work_order_id", workOrderId)
      .order("position", { ascending: true }).then(({ data }) => {
        setArticles(data || []);
        setLoading(false);
      });
  }, [workOrderId]);

  const toggleComplete = async (article: any) => {
    const newCompleted = !article.is_completed;
    const { error } = await supabase.from("work_order_article_items")
      .update({ is_completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null })
      .eq("id", article.id);
    if (error) { toast.error("Errore"); return; }
    setArticles(prev => prev.map(a => a.id === article.id ? { ...a, is_completed: newCompleted } : a));
  };

  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (articles.length === 0) return null;

  const completed = articles.filter(a => a.is_completed).length;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Da assemblare</p>
        <Badge variant="outline" className="text-[10px]">{completed}/{articles.length}</Badge>
      </div>
      {articles.map(article => (
        <button
          key={article.id}
          onClick={() => toggleComplete(article)}
          className="flex items-start gap-2 w-full text-left p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <Checkbox checked={article.is_completed} className="mt-0.5 pointer-events-none" />
          <span className={`text-xs flex-1 ${article.is_completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {article.description}
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Phase Progress Indicator ─────────────────────────────────
function PhasePipeline({ group }: { group: CustomerGroup }) {
  const phases = [
    { key: "produzione" as const, orders: group.production },
    { key: "spedizione" as const, orders: group.shipping },
    { key: "servizio" as const, orders: group.service },
  ];

  return (
    <div className="flex items-center gap-1">
      {phases.map((phase, idx) => {
        const config = phaseConfig[phase.key];
        const Icon = config.icon;
        const hasOrders = phase.orders.length > 0;
        const allDone = hasOrders && phase.orders.every(o => completedStatuses.includes(o.status));
        const someInProgress = hasOrders && phase.orders.some(o => !completedStatuses.includes(o.status) && o.status !== "da_fare" && o.status !== "da_preparare");

        return (
          <div key={phase.key} className="flex items-center">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              allDone ? "bg-green-100 text-green-700" :
              someInProgress ? `${config.lightBg} ${config.text}` :
              hasOrders ? "bg-muted text-muted-foreground" :
              "bg-muted/50 text-muted-foreground/40"
            }`}>
              {allDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              <span>{config.label}</span>
              {hasOrders && <span>({phase.orders.length})</span>}
            </div>
            {idx < 2 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 mx-1 flex-shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Phase Order Card ────────────────────────────────────────
function PhaseOrderCard({ order, onStatusChange, isPending }: {
  order: UnifiedOrder;
  onStatusChange: (id: string, type: string, newStatus: string) => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = phaseConfig[order.type];
  const Icon = config.icon;
  const statusInfo = statusLabels[order.status] || { label: order.status, color: "bg-muted text-muted-foreground" };
  const priorityInfo = order.priority ? priorityLabels[order.priority] : null;
  const statusFlow = order.type === "produzione" ? statusFlowProduzione : order.type === "servizio" ? statusFlowServizio : statusFlowSpedizione;

  const fmtDate = (d?: string | null) => {
    if (!d) return null;
    try { return format(new Date(d), "dd MMM yyyy", { locale: it }); } catch { return d; }
  };

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className={`rounded-lg border ${config.border} overflow-hidden bg-background`}>
        <CollapsibleTrigger asChild>
          <button className="w-full text-left p-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0 ${config.lightBg}`}>
                <Icon className={`h-4 w-4 ${config.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-semibold text-primary">
                    {order.sales_order_number || order.number}
                  </span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono">
                    {order.type === "produzione" ? "PROD" : order.type === "spedizione" ? "SPED" : "INST"}
                  </Badge>
                  {order.offer_number && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0">Off. {order.offer_number}</Badge>
                  )}
                  {priorityInfo?.icon && <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                </div>
                <p className="text-sm font-medium truncate mt-0.5">{order.title}</p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(order.created_at)}</span>
                  {order.scheduled_date && <span>• Previsto: {fmtDate(order.scheduled_date)}</span>}
                  {order.assigned_to_name && <span>• <User className="h-3 w-3 inline -mt-0.5" /> {order.assigned_to_name}</span>}
                  {order.article && <span className="truncate max-w-[200px]">• {order.article.split('\n')[0]}</span>}
                  {priorityInfo && <span className={priorityInfo.color}>• {priorityInfo.label}</span>}
                </div>
              </div>
              <Badge className={`${statusInfo.color} text-[10px] px-2 border flex-shrink-0`}>{statusInfo.label}</Badge>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`} />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border/50 px-3 py-3 space-y-3">
            {/* Status change */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Cambia stato</p>
              <div className="flex flex-wrap gap-1.5">
                {statusFlow.map(s => {
                  const isActive = order.status === s.value;
                  const si = statusLabels[s.value];
                  return (
                    <button
                      key={s.value}
                      disabled={isActive || isPending}
                      onClick={(e) => { e.stopPropagation(); onStatusChange(order.id, order.type, s.value); }}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                        isActive
                          ? `${si?.color || "bg-muted"} border-current ring-1 ring-offset-1 ring-current/20`
                          : "bg-background border-border text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {isActive && <CheckCircle2 className="h-3 w-3 inline mr-1 -mt-0.5" />}
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Type-specific details */}
            {order.type === "produzione" && (
              <>
                {(order.diameter || order.smoke_inlet || order.includes_installation) && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {order.diameter && <p><span className="text-muted-foreground">Diametro:</span> {order.diameter}</p>}
                    {order.smoke_inlet && <p><span className="text-muted-foreground">Fumi:</span> {order.smoke_inlet}</p>}
                    {order.includes_installation && (
                      <p className="text-blue-600 font-medium flex items-center gap-1 col-span-2"><Wrench className="h-3 w-3" /> Include installazione</p>
                    )}
                  </div>
                )}
                {order.bom_name && <p className="text-xs"><span className="text-muted-foreground">BOM:</span> {order.bom_name} (v{order.bom_version})</p>}
                <ArticlesChecklist workOrderId={order.id} />
              </>
            )}

            {order.type === "spedizione" && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                {order.shipping_address && (
                  <p className="flex items-start gap-1.5 col-span-2">
                    <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span>{[order.shipping_address, order.shipping_city, order.shipping_province, order.shipping_postal_code, order.shipping_country].filter(Boolean).join(", ")}</span>
                  </p>
                )}
                {order.preparation_date && <p><span className="text-muted-foreground">Preparazione:</span> {fmtDate(order.preparation_date)}</p>}
                {order.shipped_date && <p><span className="text-muted-foreground">Spedito:</span> {fmtDate(order.shipped_date)}</p>}
                {order.delivered_date && <p><span className="text-muted-foreground">Consegnato:</span> {fmtDate(order.delivered_date)}</p>}
              </div>
            )}

            {order.type === "servizio" && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                {order.equipment_needed && <p><span className="text-muted-foreground">Attrezzatura:</span> {order.equipment_needed}</p>}
                {order.estimated_hours != null && <p><span className="text-muted-foreground">Ore stimate:</span> {order.estimated_hours}h</p>}
                {order.actual_hours != null && <p><span className="text-muted-foreground">Ore effettive:</span> {order.actual_hours}h</p>}
              </div>
            )}

            {order.payment_on_delivery && (
              <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                <CreditCard className="h-3.5 w-3.5" />
                Pagamento alla consegna{order.payment_amount ? `: €${order.payment_amount.toLocaleString("it-IT")}` : ""}
              </div>
            )}

            {order.sales_order_number && (
              <p className="text-xs"><span className="text-muted-foreground">Ordine:</span> {order.sales_order_number}</p>
            )}

            {order.notes && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Note</p>
                <p className="text-xs text-foreground whitespace-pre-wrap bg-muted/50 p-2 rounded-md">{order.notes}</p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ─── Customer Group Card ─────────────────────────────────────
function CustomerGroupCard({ group, onStatusChange, isPending }: {
  group: CustomerGroup;
  onStatusChange: (id: string, type: string, newStatus: string) => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const totalOrders = group.production.length + group.shipping.length + group.service.length;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full text-left p-4 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted">
                <Building2 className="h-5 w-5 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-base truncate">{group.customerName}</p>
                  <Badge variant="secondary" className="text-[10px]">{totalOrders} commesse</Badge>
                </div>
                <PhasePipeline group={group} />
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`} />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border/50 p-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Production */}
              {group.production.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${phaseConfig.produzione.color}`} />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Produzione ({group.production.length})
                    </p>
                  </div>
                  {group.production.map(o => (
                    <PhaseOrderCard key={o.id} order={o} onStatusChange={onStatusChange} isPending={isPending} />
                  ))}
                </div>
              )}

              {/* Shipping */}
              {group.shipping.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${phaseConfig.spedizione.color}`} />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Spedizione ({group.shipping.length})
                    </p>
                  </div>
                  {group.shipping.map(o => (
                    <PhaseOrderCard key={o.id} order={o} onStatusChange={onStatusChange} isPending={isPending} />
                  ))}
                </div>
              )}

              {/* Service/Installation */}
              {group.service.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${phaseConfig.servizio.color}`} />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Installazione ({group.service.length})
                    </p>
                  </div>
                  {group.service.map(o => (
                    <PhaseOrderCard key={o.id} order={o} onStatusChange={onStatusChange} isPending={isPending} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ─── Main Component ─────────────────────────────────────────
export default function CommesseUnificatePage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [typeFilter, setTypeFilter] = useState("all");

  const updateStatus = useMutation({
    mutationFn: async ({ id, type, newStatus }: { id: string; type: string; newStatus: string }) => {
      const table = type === "produzione" ? "work_orders" : type === "servizio" ? "service_work_orders" : "shipping_orders";
      const { error } = await supabase.from(table).update({ status: newStatus }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stato aggiornato");
      queryClient.invalidateQueries({ queryKey: ["commesse-work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["commesse-service-orders"] });
      queryClient.invalidateQueries({ queryKey: ["commesse-shipping-orders"] });
    },
    onError: (err: any) => toast.error("Errore: " + err.message),
  });

  const handleStatusChange = (id: string, type: string, newStatus: string) => {
    updateStatus.mutate({ id, type, newStatus });
  };

  // ─── Data Fetching ──────────────────────────────────────
  const { data: workOrders = [], isLoading: loadingWO } = useQuery({
    queryKey: ["commesse-work-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select(`
          id, number, title, status, priority, scheduled_date, planned_start_date, planned_end_date,
          actual_start_date, actual_end_date, location, article, created_at, description, notes,
          diameter, smoke_inlet, includes_installation, payment_on_delivery, payment_amount, lead_id,
          sales_order_id,
          customers(name, code),
          profiles!work_orders_assigned_to_fkey(first_name, last_name),
          boms(name, version),
          sales_orders(number),
          offers(number)
        `)
        .eq("archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((wo: any): UnifiedOrder => ({
        id: wo.id, number: wo.number, title: wo.title || wo.article || wo.number,
        status: wo.status || "da_fare", type: "produzione", priority: wo.priority,
        scheduled_date: wo.scheduled_date, planned_start_date: wo.planned_start_date,
        planned_end_date: wo.planned_end_date, actual_start_date: wo.actual_start_date,
        actual_end_date: wo.actual_end_date, location: wo.location, article: wo.article,
        customer_name: wo.customers?.name, customer_code: wo.customers?.code,
        created_at: wo.created_at, description: wo.description,
        assigned_to_name: wo.profiles ? `${wo.profiles.first_name || ""} ${wo.profiles.last_name || ""}`.trim() : undefined,
        notes: wo.notes, diameter: wo.diameter, smoke_inlet: wo.smoke_inlet,
        includes_installation: wo.includes_installation,
        payment_on_delivery: wo.payment_on_delivery, payment_amount: wo.payment_amount,
        lead_id: wo.lead_id, sales_order_id: wo.sales_order_id,
        bom_name: wo.boms?.name, bom_version: wo.boms?.version,
        sales_order_number: wo.sales_orders?.number, offer_number: wo.offers?.number,
      }));
    },
  });

  const { data: serviceOrders = [], isLoading: loadingSWO } = useQuery({
    queryKey: ["commesse-service-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_work_orders")
        .select(`
          id, number, title, status, priority, scheduled_date, actual_start_date, actual_end_date,
          estimated_hours, actual_hours, location, article, created_at, description, notes,
          equipment_needed, lead_id, sales_order_id,
          customers(name, code),
          profiles!service_work_orders_assigned_to_fkey(first_name, last_name),
          sales_orders(number)
        `)
        .eq("archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((so: any): UnifiedOrder => ({
        id: so.id, number: so.number, title: so.title || so.article || so.number,
        status: so.status || "da_fare", type: "servizio", priority: so.priority,
        scheduled_date: so.scheduled_date, actual_start_date: so.actual_start_date,
        actual_end_date: so.actual_end_date, estimated_hours: so.estimated_hours,
        actual_hours: so.actual_hours, location: so.location, article: so.article,
        customer_name: so.customers?.name, customer_code: so.customers?.code,
        created_at: so.created_at, description: so.description,
        assigned_to_name: so.profiles ? `${so.profiles.first_name || ""} ${so.profiles.last_name || ""}`.trim() : undefined,
        notes: so.notes, equipment_needed: so.equipment_needed, lead_id: so.lead_id,
        sales_order_id: so.sales_order_id,
        sales_order_number: so.sales_orders?.number,
      }));
    },
  });

  const { data: shippingOrders = [], isLoading: loadingSO } = useQuery({
    queryKey: ["commesse-shipping-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_orders")
        .select(`
          id, number, status, shipping_address, shipping_city, shipping_country,
          shipping_province, shipping_postal_code, article, created_at, notes,
          preparation_date, shipped_date, delivered_date, payment_on_delivery, payment_amount,
          assigned_to, sales_order_id,
          customers(name, code),
          profiles!shipping_orders_assigned_to_fkey(first_name, last_name),
          sales_orders(number)
        `)
        .eq("archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((so: any): UnifiedOrder => ({
        id: so.id, number: so.number, title: so.article || so.number,
        status: so.status || "da_preparare", type: "spedizione",
        location: [so.shipping_city, so.shipping_address].filter(Boolean).join(" - "),
        article: so.article, customer_name: so.customers?.name, customer_code: so.customers?.code,
        created_at: so.created_at, shipping_address: so.shipping_address,
        shipping_city: so.shipping_city, shipping_country: so.shipping_country,
        shipping_province: so.shipping_province, shipping_postal_code: so.shipping_postal_code,
        notes: so.notes, preparation_date: so.preparation_date,
        shipped_date: so.shipped_date, delivered_date: so.delivered_date,
        payment_on_delivery: so.payment_on_delivery, payment_amount: so.payment_amount,
        assigned_to_name: so.profiles ? `${so.profiles.first_name || ""} ${so.profiles.last_name || ""}`.trim() : undefined,
        sales_order_number: so.sales_orders?.number,
        sales_order_id: so.sales_order_id,
      }));
    },
  });

  const isLoading = loadingWO || loadingSWO || loadingSO;
  const allOrders = useMemo(() => [...workOrders, ...serviceOrders, ...shippingOrders], [workOrders, serviceOrders, shippingOrders]);

  const filteredOrders = useMemo(() => {
    return allOrders.filter((o) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch = !q || o.title.toLowerCase().includes(q) || o.number.toLowerCase().includes(q) ||
        (o.customer_name || "").toLowerCase().includes(q) || (o.article || "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" ||
        (statusFilter === "active" && !completedStatuses.includes(o.status)) ||
        (statusFilter === "completed" && completedStatuses.includes(o.status));
      const matchesType = typeFilter === "all" || o.type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [allOrders, searchTerm, statusFilter, typeFilter]);

  const customerGroups = useMemo((): CustomerGroup[] => {
    const groupMap = new Map<string, CustomerGroup>();
    filteredOrders.forEach(order => {
      const key = order.customer_name || order.sales_order_id || order.id;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key,
          customerName: order.customer_name || order.title,
          customerCode: order.customer_code,
          production: [], shipping: [], service: [],
          phases: { produzione: "", spedizione: "", servizio: "" },
        });
      }
      const group = groupMap.get(key)!;
      if (!group.customerCode && order.customer_code) group.customerCode = order.customer_code;
      if (order.type === "produzione") group.production.push(order);
      else if (order.type === "spedizione") group.shipping.push(order);
      else if (order.type === "servizio") group.service.push(order);
    });
    return Array.from(groupMap.values()).sort((a, b) => {
      const aActive = [...a.production, ...a.shipping, ...a.service].some(o => !completedStatuses.includes(o.status));
      const bActive = [...b.production, ...b.shipping, ...b.service].some(o => !completedStatuses.includes(o.status));
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return a.customerName.localeCompare(b.customerName);
    });
  }, [filteredOrders]);

  const totalCustomers = customerGroups.length;
  const totalOrders = filteredOrders.length;

  // Stats
  const stats = useMemo(() => ({
    production: workOrders.filter(o => !completedStatuses.includes(o.status)).length,
    shipping: shippingOrders.filter(o => !completedStatuses.includes(o.status)).length,
    service: serviceOrders.filter(o => !completedStatuses.includes(o.status)).length,
  }), [workOrders, shippingOrders, serviceOrders]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Commesse</h1>
        <p className="text-muted-foreground">
          Pipeline unificata per cliente · {totalCustomers} clienti · {totalOrders} commesse
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(["produzione", "spedizione", "servizio"] as const).map(phase => {
          const config = phaseConfig[phase];
          const Icon = config.icon;
          const count = stats[phase === "servizio" ? "service" : phase === "spedizione" ? "shipping" : "production"];
          return (
            <Card key={phase} className="p-4">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${config.lightBg}`}>
                  <Icon className={`h-5 w-5 ${config.text}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">{config.label} attive</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca cliente, commessa, articolo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Attive</SelectItem>
            <SelectItem value="completed">Completate</SelectItem>
            <SelectItem value="all">Tutte</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tipi</SelectItem>
            <SelectItem value="produzione">Produzione</SelectItem>
            <SelectItem value="spedizione">Spedizione</SelectItem>
            <SelectItem value="servizio">Installazione</SelectItem>
          </SelectContent>
        </Select>

        {/* Phase legend */}
        <div className="flex items-center gap-4 ml-auto">
          {(["produzione", "spedizione", "servizio"] as const).map(phase => {
            const c = phaseConfig[phase];
            return (
              <div key={phase} className={`flex items-center gap-1.5 text-xs ${c.text} font-medium`}>
                <div className={`h-2.5 w-2.5 rounded-full ${c.color}`} />
                {c.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Customer groups */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : customerGroups.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Nessuna commessa trovata</div>
        ) : (
          customerGroups.map(group => (
            <CustomerGroupCard
              key={group.key}
              group={group}
              onStatusChange={handleStatusChange}
              isPending={updateStatus.isPending}
            />
          ))
        )}
      </div>
    </div>
  );
}
