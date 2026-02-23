import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Search, Loader2, Wrench, Truck, Settings,
  Calendar, MapPin, User, Package, Clock, ChevronDown,
  FileText, AlertTriangle, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";

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
  created_at: string;
  description?: string;
  assigned_to?: string;
  notes?: string;
  shipping_address?: string;
  shipping_city?: string;
  shipping_country?: string;
  shipping_province?: string;
  shipping_postal_code?: string;
  order_id?: string;
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
}

const statusLabels: Record<string, { label: string; color: string }> = {
  da_fare: { label: "Da fare", color: "bg-amber-100 text-amber-700 border-amber-200" },
  planned: { label: "Pianificato", color: "bg-blue-100 text-blue-700 border-blue-200" },
  in_lavorazione: { label: "In lavorazione", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  in_test: { label: "In test", color: "bg-purple-100 text-purple-700 border-purple-200" },
  pronto: { label: "Pronto", color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  completato: { label: "Completato", color: "bg-green-100 text-green-700 border-green-200" },
  completata: { label: "Completata", color: "bg-green-100 text-green-700 border-green-200" },
  da_preparare: { label: "Da preparare", color: "bg-amber-100 text-amber-700 border-amber-200" },
  spedito: { label: "Spedito", color: "bg-green-100 text-green-700 border-green-200" },
  standby: { label: "Standby", color: "bg-gray-100 text-gray-600 border-gray-200" },
  bloccato: { label: "Bloccato", color: "bg-red-100 text-red-700 border-red-200" },
  in_progress: { label: "In corso", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  completed: { label: "Completato", color: "bg-green-100 text-green-700 border-green-200" },
  testing: { label: "Testing", color: "bg-purple-100 text-purple-700 border-purple-200" },
};

const typeConfig = {
  produzione: { label: "Produzione", icon: Settings, borderColor: "border-l-purple-500", bgHeader: "bg-purple-50", textColor: "text-purple-700", badgeBg: "bg-purple-100 text-purple-700" },
  servizio: { label: "Servizio", icon: Wrench, borderColor: "border-l-blue-500", bgHeader: "bg-blue-50", textColor: "text-blue-700", badgeBg: "bg-blue-100 text-blue-700" },
  spedizione: { label: "Spedizione", icon: Truck, borderColor: "border-l-amber-500", bgHeader: "bg-amber-50", textColor: "text-amber-700", badgeBg: "bg-amber-100 text-amber-700" },
};

const priorityLabels: Record<string, { label: string; color: string; icon?: boolean }> = {
  low: { label: "Bassa", color: "text-muted-foreground" },
  medium: { label: "Media", color: "text-amber-600" },
  high: { label: "Alta", color: "text-orange-600 font-semibold", icon: true },
  urgent: { label: "Urgente", color: "text-red-600 font-bold", icon: true },
};

// Status flow per tipo
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

export default function ZAppCommesse() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleCard = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Mutation per cambio stato
  const updateStatus = useMutation({
    mutationFn: async ({ id, type, newStatus }: { id: string; type: string; newStatus: string }) => {
      const table = type === "produzione" ? "work_orders" : type === "servizio" ? "service_work_orders" : "shipping_orders";
      const { error } = await supabase.from(table).update({ status: newStatus }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stato aggiornato");
      queryClient.invalidateQueries({ queryKey: ["zapp-work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["zapp-service-work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["zapp-shipping-orders"] });
    },
    onError: (err: any) => {
      toast.error("Errore: " + err.message);
    },
  });

  const { data: workOrders = [], isLoading: loadingWO } = useQuery({
    queryKey: ["zapp-work-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("id, number, title, status, priority, scheduled_date, planned_start_date, planned_end_date, actual_start_date, actual_end_date, location, article, created_at, description, assigned_to, notes, sales_order_id, diameter, smoke_inlet, includes_installation, payment_on_delivery, payment_amount, customers(name), profiles!work_orders_assigned_to_fkey(first_name, last_name)")
        .eq("archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((wo: any): UnifiedOrder => ({
        id: wo.id, number: wo.number, title: wo.title || wo.article || wo.number,
        status: wo.status || "da_fare", type: "produzione", priority: wo.priority,
        scheduled_date: wo.scheduled_date, planned_start_date: wo.planned_start_date,
        planned_end_date: wo.planned_end_date, actual_start_date: wo.actual_start_date,
        actual_end_date: wo.actual_end_date,
        location: wo.location, article: wo.article,
        customer_name: wo.customers?.name, created_at: wo.created_at,
        description: wo.description,
        assigned_to: wo.profiles ? `${wo.profiles.first_name || ""} ${wo.profiles.last_name || ""}`.trim() || wo.assigned_to : wo.assigned_to,
        notes: wo.notes, order_id: wo.sales_order_id,
        diameter: wo.diameter, smoke_inlet: wo.smoke_inlet,
        includes_installation: wo.includes_installation,
        payment_on_delivery: wo.payment_on_delivery, payment_amount: wo.payment_amount,
      }));
    },
  });

  const { data: serviceOrders = [], isLoading: loadingSWO } = useQuery({
    queryKey: ["zapp-service-work-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_work_orders")
        .select("id, number, title, status, priority, scheduled_date, actual_start_date, actual_end_date, estimated_hours, actual_hours, location, article, created_at, description, assigned_to, notes, sales_order_id, equipment_needed, customers(name), profiles!service_work_orders_assigned_to_fkey(first_name, last_name)")
        .eq("archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((so: any): UnifiedOrder => ({
        id: so.id, number: so.number, title: so.title || so.article || so.number,
        status: so.status || "da_fare", type: "servizio", priority: so.priority,
        scheduled_date: so.scheduled_date,
        actual_start_date: so.actual_start_date, actual_end_date: so.actual_end_date,
        estimated_hours: so.estimated_hours, actual_hours: so.actual_hours,
        location: so.location, article: so.article,
        customer_name: so.customers?.name, created_at: so.created_at,
        description: so.description,
        assigned_to: so.profiles ? `${so.profiles.first_name || ""} ${so.profiles.last_name || ""}`.trim() || so.assigned_to : so.assigned_to,
        notes: so.notes, order_id: so.sales_order_id,
        equipment_needed: so.equipment_needed,
      }));
    },
  });

  const { data: shippingOrders = [], isLoading: loadingSO } = useQuery({
    queryKey: ["zapp-shipping-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_orders")
        .select("id, number, status, shipping_address, shipping_city, shipping_country, shipping_province, shipping_postal_code, article, created_at, notes, preparation_date, shipped_date, delivered_date, payment_on_delivery, payment_amount, customers(name), profiles!shipping_orders_assigned_to_fkey(first_name, last_name), assigned_to")
        .eq("archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((so: any): UnifiedOrder => ({
        id: so.id, number: so.number, title: so.article || so.number,
        status: so.status || "da_preparare", type: "spedizione",
        location: [so.shipping_city, so.shipping_address].filter(Boolean).join(" - "),
        article: so.article, customer_name: so.customers?.name, created_at: so.created_at,
        shipping_address: so.shipping_address, shipping_city: so.shipping_city,
        shipping_country: so.shipping_country, shipping_province: so.shipping_province,
        shipping_postal_code: so.shipping_postal_code,
        notes: so.notes, preparation_date: so.preparation_date,
        shipped_date: so.shipped_date, delivered_date: so.delivered_date,
        payment_on_delivery: so.payment_on_delivery, payment_amount: so.payment_amount,
        assigned_to: so.profiles ? `${so.profiles.first_name || ""} ${so.profiles.last_name || ""}`.trim() || so.assigned_to : so.assigned_to,
      }));
    },
  });

  const isLoading = loadingWO || loadingSWO || loadingSO;
  const allOrders = useMemo(() => [...workOrders, ...serviceOrders, ...shippingOrders], [workOrders, serviceOrders, shippingOrders]);
  const completedStatuses = ["completato", "completata", "spedito", "completed", "closed"];

  const filteredOrders = useMemo(() => {
    return allOrders.filter((o) => {
      const matchesSearch = o.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.customer_name || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" ||
        (statusFilter === "active" && !completedStatuses.includes(o.status)) ||
        (statusFilter === "completed" && completedStatuses.includes(o.status));
      return matchesSearch && matchesStatus;
    });
  }, [allOrders, searchTerm, statusFilter]);

  const ordersByType = (type: "produzione" | "servizio" | "spedizione" | "all") => {
    if (type === "all") return filteredOrders;
    return filteredOrders.filter((o) => o.type === type);
  };

  const counts = {
    all: filteredOrders.length,
    produzione: ordersByType("produzione").length,
    servizio: ordersByType("servizio").length,
    spedizione: ordersByType("spedizione").length,
  };

  const formatDate = (date?: string | null) => {
    if (!date) return null;
    try { return format(new Date(date), "dd MMM yyyy", { locale: it }); } catch { return date; }
  };

  const formatDateTime = (date?: string | null) => {
    if (!date) return null;
    try { return format(new Date(date), "dd MMM yyyy, HH:mm", { locale: it }); } catch { return date; }
  };

  const renderDetailRow = (icon: React.ReactNode, label: string, value?: string | null) => {
    if (!value) return null;
    return (
      <div className="flex items-start gap-2 text-[12px]">
        <span className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</span>
        <div>
          <span className="text-muted-foreground">{label}: </span>
          <span className="text-foreground font-medium">{value}</span>
        </div>
      </div>
    );
  };

  const getStatusFlow = (type: string) => {
    if (type === "produzione") return statusFlowProduzione;
    if (type === "servizio") return statusFlowServizio;
    return statusFlowSpedizione;
  };

  const renderOrder = (order: UnifiedOrder) => {
    const config = typeConfig[order.type];
    const Icon = config.icon;
    const statusInfo = statusLabels[order.status] || { label: order.status, color: "bg-muted text-muted-foreground" };
    const priorityInfo = order.priority ? priorityLabels[order.priority] : null;
    const cardKey = `${order.type}-${order.id}`;
    const isExpanded = expandedCards.has(cardKey);
    const statusFlow = getStatusFlow(order.type);

    return (
      <Collapsible key={cardKey} open={isExpanded} onOpenChange={() => toggleCard(cardKey)}>
        <div className={`bg-white rounded-xl shadow-sm border border-border border-l-4 ${config.borderColor} overflow-hidden`}>
          {/* Header */}
          <CollapsibleTrigger asChild>
            <button className="w-full text-left p-3 active:bg-muted/30 transition-colors">
              <div className="flex items-start gap-2.5">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${config.bgHeader}`}>
                  <Icon className={`h-4.5 w-4.5 ${config.textColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="font-semibold text-[13px] truncate flex-1">{order.title}</p>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[11px] text-muted-foreground font-mono">{order.number}</p>
                    {priorityInfo && (
                      <span className={`text-[10px] flex items-center gap-0.5 ${priorityInfo.color}`}>
                        {priorityInfo.icon && <AlertTriangle className="h-3 w-3" />}
                        {priorityInfo.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`${statusInfo.color} text-[10px] px-1.5 border`}>{statusInfo.label}</Badge>
                    <Badge className={`${config.badgeBg} text-[10px] px-1.5 border-0`}>{config.label}</Badge>
                    {order.customer_name && (
                      <span className="text-[10px] text-muted-foreground truncate">👤 {order.customer_name}</span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          </CollapsibleTrigger>

          {/* Expanded details */}
          <CollapsibleContent>
            <div className="border-t border-border/50">
              {/* Status change section */}
              <div className="px-3 py-3 bg-muted/30">
                <p className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Cambia stato</p>
                <div className="flex flex-wrap gap-1.5">
                  {statusFlow.map(s => {
                    const isActive = order.status === s.value;
                    const si = statusLabels[s.value];
                    return (
                      <button
                        key={s.value}
                        disabled={isActive || updateStatus.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateStatus.mutate({ id: order.id, type: order.type, newStatus: s.value });
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                          isActive
                            ? `${si?.color || "bg-muted"} border-current ring-2 ring-offset-1 ring-current/20`
                            : "bg-white border-border text-muted-foreground hover:bg-muted/50 active:scale-95"
                        }`}
                      >
                        {isActive && <CheckCircle2 className="h-3 w-3 inline mr-1 -mt-0.5" />}
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Details section */}
              <div className="px-3 pb-3 pt-2 space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Dettagli</p>

                {renderDetailRow(<User className="h-3.5 w-3.5" />, "Cliente", order.customer_name)}
                {renderDetailRow(<User className="h-3.5 w-3.5" />, "Assegnato a", order.assigned_to)}
                {renderDetailRow(<Package className="h-3.5 w-3.5" />, "Articolo", order.article)}
                {renderDetailRow(<FileText className="h-3.5 w-3.5" />, "Descrizione", order.description)}

                {/* Date */}
                {renderDetailRow(<Calendar className="h-3.5 w-3.5" />, "Data pianificata", formatDate(order.scheduled_date))}
                {renderDetailRow(<Calendar className="h-3.5 w-3.5" />, "Inizio pianificato", formatDate(order.planned_start_date))}
                {renderDetailRow(<Calendar className="h-3.5 w-3.5" />, "Fine pianificata", formatDate(order.planned_end_date))}
                {renderDetailRow(<Calendar className="h-3.5 w-3.5" />, "Inizio effettivo", formatDate(order.actual_start_date))}
                {renderDetailRow(<Calendar className="h-3.5 w-3.5" />, "Fine effettiva", formatDate(order.actual_end_date))}

                {/* Location */}
                {renderDetailRow(<MapPin className="h-3.5 w-3.5" />, "Località", order.location)}

                {/* Produzione specifics */}
                {order.type === "produzione" && (
                  <>
                    {renderDetailRow(<Settings className="h-3.5 w-3.5" />, "Diametro", order.diameter)}
                    {renderDetailRow(<Settings className="h-3.5 w-3.5" />, "Ingresso fumi", order.smoke_inlet)}
                    {order.includes_installation && (
                      <div className="flex items-center gap-2 text-[12px]">
                        <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-blue-600 font-medium">Include installazione</span>
                      </div>
                    )}
                  </>
                )}

                {/* Servizio specifics */}
                {order.type === "servizio" && (
                  <>
                    {renderDetailRow(<Settings className="h-3.5 w-3.5" />, "Attrezzatura necessaria", order.equipment_needed)}
                    {order.estimated_hours != null && renderDetailRow(<Clock className="h-3.5 w-3.5" />, "Ore stimate", `${order.estimated_hours}h`)}
                    {order.actual_hours != null && renderDetailRow(<Clock className="h-3.5 w-3.5" />, "Ore effettive", `${order.actual_hours}h`)}
                  </>
                )}

                {/* Spedizione specifics */}
                {order.type === "spedizione" && (
                  <>
                    {renderDetailRow(<MapPin className="h-3.5 w-3.5" />, "Indirizzo", order.shipping_address)}
                    {renderDetailRow(<MapPin className="h-3.5 w-3.5" />, "Città", [order.shipping_city, order.shipping_province].filter(Boolean).join(" "))}
                    {renderDetailRow(<MapPin className="h-3.5 w-3.5" />, "CAP", order.shipping_postal_code)}
                    {renderDetailRow(<MapPin className="h-3.5 w-3.5" />, "Paese", order.shipping_country)}
                    {renderDetailRow(<Calendar className="h-3.5 w-3.5" />, "Data preparazione", formatDate(order.preparation_date))}
                    {renderDetailRow(<Truck className="h-3.5 w-3.5" />, "Data spedizione", formatDate(order.shipped_date))}
                    {renderDetailRow(<CheckCircle2 className="h-3.5 w-3.5" />, "Data consegna", formatDate(order.delivered_date))}
                  </>
                )}

                {/* Pagamento */}
                {order.payment_on_delivery && (
                  <div className="flex items-center gap-2 text-[12px] mt-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-amber-700 font-medium">
                      Pagamento alla consegna{order.payment_amount ? `: €${order.payment_amount.toLocaleString("it-IT")}` : ""}
                    </span>
                  </div>
                )}

                {/* Notes */}
                {order.notes && (
                  <div className="mt-2 p-2 bg-muted/50 rounded-lg">
                    <p className="text-[11px] font-semibold text-muted-foreground mb-0.5">Note</p>
                    <p className="text-[12px] text-foreground whitespace-pre-wrap">{order.notes}</p>
                  </div>
                )}

                {/* Meta */}
                <div className="pt-2 border-t border-border/30 mt-2">
                  {renderDetailRow(<Clock className="h-3.5 w-3.5" />, "Creata il", formatDateTime(order.created_at))}
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      <div className="bg-purple-600 text-white px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate("/hr/z-app")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Commesse</h1>
            <p className="text-purple-100 text-xs">{counts.all} commesse trovate</p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 pt-3 pb-1 flex gap-3 flex-wrap">
        {(["produzione", "servizio", "spedizione"] as const).map(t => {
          const c = typeConfig[t];
          return (
            <div key={t} className={`flex items-center gap-1.5 text-[11px] ${c.textColor} font-medium`}>
              <div className={`h-2.5 w-2.5 rounded-full ${c.borderColor.replace("border-l-", "bg-")}`} />
              {c.label}
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cerca commessa, numero, cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 rounded-xl bg-white" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[110px] rounded-xl bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Attive</SelectItem>
              <SelectItem value="completed">Completate</SelectItem>
              <SelectItem value="all">Tutte</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="all" className="px-4">
        <TabsList className="w-full grid grid-cols-4 h-9 rounded-xl">
          <TabsTrigger value="all" className="rounded-lg text-[11px] px-1">Tutte ({counts.all})</TabsTrigger>
          <TabsTrigger value="produzione" className="rounded-lg text-[11px] px-1">Prod ({counts.produzione})</TabsTrigger>
          <TabsTrigger value="servizio" className="rounded-lg text-[11px] px-1">Serv ({counts.servizio})</TabsTrigger>
          <TabsTrigger value="spedizione" className="rounded-lg text-[11px] px-1">Sped ({counts.spedizione})</TabsTrigger>
        </TabsList>

        {(["all", "produzione", "servizio", "spedizione"] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-3 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : ordersByType(tab).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">Nessuna commessa trovata</div>
            ) : (
              ordersByType(tab).map(renderOrder)
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
