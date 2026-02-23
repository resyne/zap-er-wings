import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Loader2, Wrench, Truck, Settings, ChevronRight, Calendar, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { it } from "date-fns/locale";

// Unified order type for display
interface UnifiedOrder {
  id: string;
  number: string;
  title: string;
  status: string;
  type: "produzione" | "servizio" | "spedizione";
  priority?: string;
  scheduled_date?: string;
  location?: string;
  article?: string;
  customer_name?: string;
  created_at: string;
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
};

const typeConfig = {
  produzione: { label: "Produzione", icon: Settings, color: "bg-purple-100 text-purple-600" },
  servizio: { label: "Servizio", icon: Wrench, color: "bg-blue-100 text-blue-600" },
  spedizione: { label: "Spedizione", icon: Truck, color: "bg-amber-100 text-amber-600" },
};

const priorityLabels: Record<string, { label: string; color: string }> = {
  low: { label: "Bassa", color: "text-muted-foreground" },
  medium: { label: "Media", color: "text-amber-600" },
  high: { label: "Alta", color: "text-orange-600" },
  urgent: { label: "Urgente", color: "text-red-600" },
};

export default function ZAppCommesse() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");

  // Fetch work orders (produzione)
  const { data: workOrders = [], isLoading: loadingWO } = useQuery({
    queryKey: ["zapp-work-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("id, number, title, status, priority, scheduled_date, location, article, created_at, customers(name)")
        .eq("archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((wo: any): UnifiedOrder => ({
        id: wo.id,
        number: wo.number,
        title: wo.title || wo.article || wo.number,
        status: wo.status || "da_fare",
        type: "produzione",
        priority: wo.priority,
        scheduled_date: wo.scheduled_date,
        location: wo.location,
        article: wo.article,
        customer_name: wo.customers?.name,
        created_at: wo.created_at,
      }));
    },
  });

  // Fetch service work orders (servizio)
  const { data: serviceOrders = [], isLoading: loadingSWO } = useQuery({
    queryKey: ["zapp-service-work-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_work_orders")
        .select("id, number, title, status, priority, scheduled_date, location, article, created_at, customers(name)")
        .eq("archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((so: any): UnifiedOrder => ({
        id: so.id,
        number: so.number,
        title: so.title || so.article || so.number,
        status: so.status || "da_fare",
        type: "servizio",
        priority: so.priority,
        scheduled_date: so.scheduled_date,
        location: so.location,
        article: so.article,
        customer_name: so.customers?.name,
        created_at: so.created_at,
      }));
    },
  });

  // Fetch shipping orders (spedizione)
  const { data: shippingOrders = [], isLoading: loadingSO } = useQuery({
    queryKey: ["zapp-shipping-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_orders")
        .select("id, number, status, shipping_address, shipping_city, article, created_at, customers(name)")
        .eq("archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((so: any): UnifiedOrder => ({
        id: so.id,
        number: so.number,
        title: so.article || so.number,
        status: so.status || "da_preparare",
        type: "spedizione",
        location: [so.shipping_city, so.shipping_address].filter(Boolean).join(" - "),
        article: so.article,
        customer_name: so.customers?.name,
        created_at: so.created_at,
      }));
    },
  });

  const isLoading = loadingWO || loadingSWO || loadingSO;
  const allOrders = useMemo(() => [...workOrders, ...serviceOrders, ...shippingOrders], [workOrders, serviceOrders, shippingOrders]);

  const completedStatuses = ["completato", "completata", "spedito"];

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

  const renderOrder = (order: UnifiedOrder) => {
    const config = typeConfig[order.type];
    const Icon = config.icon;
    const statusInfo = statusLabels[order.status] || { label: order.status, color: "bg-muted text-muted-foreground" };
    const priorityInfo = order.priority ? priorityLabels[order.priority] : null;

    return (
      <div key={`${order.type}-${order.id}`} className="bg-white rounded-xl p-3 shadow-sm border border-border">
        <div className="flex items-start gap-2.5">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${config.color}`}>
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <p className="font-semibold text-[13px] truncate flex-1">{order.title}</p>
              {priorityInfo && (
                <span className={`text-[10px] font-medium ${priorityInfo.color}`}>{priorityInfo.label}</span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">{order.number}</p>
            {order.customer_name && (
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">👤 {order.customer_name}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <Badge className={`${statusInfo.color} text-[10px] px-1.5 border`}>{statusInfo.label}</Badge>
              <Badge variant="outline" className="text-[10px] px-1.5">{config.label}</Badge>
              {order.scheduled_date && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(order.scheduled_date), "dd MMM", { locale: it })}
                </span>
              )}
              {order.location && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 truncate max-w-[120px]">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  {order.location}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      {/* Header */}
      <div className="bg-purple-600 text-white px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate("/hr/z-app")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Commesse</h1>
            <p className="text-purple-100 text-xs">{counts.all} commesse attive</p>
          </div>
        </div>
      </div>

      {/* Search + Status Filter */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca commessa, numero, cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 rounded-xl bg-white"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[110px] rounded-xl bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Attive</SelectItem>
              <SelectItem value="completed">Completate</SelectItem>
              <SelectItem value="all">Tutte</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs by type */}
      <Tabs defaultValue="all" className="px-4">
        <TabsList className="w-full grid grid-cols-4 h-9 rounded-xl">
          <TabsTrigger value="all" className="rounded-lg text-[11px] px-1">
            Tutte ({counts.all})
          </TabsTrigger>
          <TabsTrigger value="produzione" className="rounded-lg text-[11px] px-1">
            Prod ({counts.produzione})
          </TabsTrigger>
          <TabsTrigger value="servizio" className="rounded-lg text-[11px] px-1">
            Serv ({counts.servizio})
          </TabsTrigger>
          <TabsTrigger value="spedizione" className="rounded-lg text-[11px] px-1">
            Sped ({counts.spedizione})
          </TabsTrigger>
        </TabsList>

        {(["all", "produzione", "servizio", "spedizione"] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-3 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : ordersByType(tab).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Nessuna commessa trovata
              </div>
            ) : (
              ordersByType(tab).map(renderOrder)
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
