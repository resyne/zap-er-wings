import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Search, Truck, Clock, CheckCircle, Package,
  ChevronRight, Calendar, History, AlertCircle
} from "lucide-react";

interface PurchaseOrder {
  id: string;
  number: string;
  order_date: string;
  expected_delivery_date?: string;
  estimated_delivery_date?: string;
  production_status: string;
  priority?: string;
  notes?: string;
  supplier_confirmed_at?: string;
  suppliers?: { name: string };
  purchase_order_items?: Array<{
    id: string;
    quantity: number;
    material: { name: string; code: string } | null;
  }>;
}

interface POLog {
  id: string;
  event_type: string;
  description: string;
  performer_label?: string;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "In Attesa", color: "bg-amber-100 text-amber-800 border-amber-200", icon: Clock },
  confirmed: { label: "Confermato", color: "bg-blue-100 text-blue-800 border-blue-200", icon: CheckCircle },
  in_production: { label: "In Produzione", color: "bg-purple-100 text-purple-800 border-purple-200", icon: Package },
  ready_to_ship: { label: "Pronto", color: "bg-teal-100 text-teal-800 border-teal-200", icon: Package },
  shipped: { label: "Spedito", color: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: Truck },
  delivered: { label: "Consegnato", color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
  cancelled: { label: "Annullato", color: "bg-red-100 text-red-800 border-red-200", icon: AlertCircle },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  urgente: { label: "Urgente", color: "bg-red-500 text-white" },
  alta: { label: "Alta", color: "bg-orange-500 text-white" },
  media: { label: "Media", color: "bg-yellow-500 text-white" },
  bassa: { label: "Bassa", color: "bg-blue-500 text-white" },
};

export default function ZAppOrdiniFornitoriPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [logs, setLogs] = useState<POLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(`
          id, number, order_date, expected_delivery_date, estimated_delivery_date,
          production_status, priority, notes, supplier_confirmed_at,
          suppliers(name),
          purchase_order_items(
            id, quantity,
            material:materials(name, code)
          )
        `)
        .or("archived.is.null,archived.eq.false")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders((data || []) as unknown as PurchaseOrder[]);
    } catch (err) {
      console.error("Error loading POs:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async (orderId: string) => {
    setLogsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("purchase_order_logs")
        .select("*")
        .eq("purchase_order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error("Error loading logs:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  const openDetail = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    loadLogs(order.id);
  };

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== "all" && o.production_status !== statusFilter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      o.number?.toLowerCase().includes(term) ||
      o.suppliers?.name?.toLowerCase().includes(term)
    );
  });

  const getLogIcon = (eventType: string) => {
    switch (eventType) {
      case "created": return "📝";
      case "supplier_confirmed": return "✅";
      case "status_changed": return "🔄";
      case "edited": return "✏️";
      case "email_sent": return "📧";
      case "whatsapp_sent": return "💬";
      default: return "📋";
    }
  };

  if (selectedOrder) {
    const sc = statusConfig[selectedOrder.production_status] || statusConfig.pending;
    const StatusIcon = sc.icon;
    const items = selectedOrder.purchase_order_items || [];

    return (
      <div className="min-h-screen bg-muted/30">
        {/* Header */}
        <div className="bg-orange-600 text-white px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setSelectedOrder(null)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold truncate">{selectedOrder.number}</h1>
              <p className="text-orange-100 text-sm">{selectedOrder.suppliers?.name}</p>
            </div>
            <Badge className={`${sc.color} border text-xs`}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {sc.label}
            </Badge>
          </div>
        </div>

        <div className="p-4 space-y-4 max-w-2xl mx-auto">
          {/* Order Info */}
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Dettagli Ordine</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Data Ordine</span>
                <p className="font-medium">{new Date(selectedOrder.order_date).toLocaleDateString("it-IT")}</p>
              </div>
              {selectedOrder.expected_delivery_date && (
                <div>
                  <span className="text-muted-foreground">Consegna Richiesta</span>
                  <p className="font-medium">{new Date(selectedOrder.expected_delivery_date).toLocaleDateString("it-IT")}</p>
                </div>
              )}
              {selectedOrder.estimated_delivery_date && (
                <div>
                  <span className="text-muted-foreground">Consegna Confermata</span>
                  <p className="font-medium text-emerald-600 flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {new Date(selectedOrder.estimated_delivery_date).toLocaleDateString("it-IT")}
                  </p>
                </div>
              )}
              {selectedOrder.priority && (
                <div>
                  <span className="text-muted-foreground">Priorità</span>
                  <Badge className={`${priorityConfig[selectedOrder.priority]?.color || "bg-gray-200"} text-xs mt-1`}>
                    {priorityConfig[selectedOrder.priority]?.label || selectedOrder.priority}
                  </Badge>
                </div>
              )}
            </div>
            {selectedOrder.notes && (
              <div className="pt-2 border-t text-sm">
                <span className="text-muted-foreground">Note:</span>
                <p className="mt-1">{selectedOrder.notes}</p>
              </div>
            )}
          </div>

          {/* Items - NO PRICES */}
          <div className="bg-white rounded-xl border p-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">
              Materiali ({items.length})
            </h3>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">
                      {item.material?.name || "Materiale"}
                    </p>
                    {item.material?.code && (
                      <p className="text-xs text-muted-foreground">{item.material.code}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-base font-bold px-3 ml-2 shrink-0">
                    x{item.quantity}
                  </Badge>
                </div>
              ))}
              {items.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">Nessun materiale</p>
              )}
            </div>
          </div>

          {/* Logs / Cronologia */}
          <div className="bg-white rounded-xl border p-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <History className="h-4 w-4" />
              Cronologia
            </h3>
            {logsLoading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : logs.length > 0 ? (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="flex gap-3 text-sm">
                    <span className="text-lg shrink-0">{getLogIcon(log.event_type)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground">{log.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {log.performer_label && `${log.performer_label} · `}
                        {new Date(log.created_at).toLocaleDateString("it-IT")} {new Date(log.created_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Nessun evento registrato</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-orange-600 text-white px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate("/hr/z-app")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">Ordini Fornitori</h1>
            <p className="text-orange-100 text-sm">Ordini di acquisto ai fornitori</p>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per numero o fornitore..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>

        {/* Status Filter Tabs */}
        <ScrollArea className="w-full">
          <div className="flex gap-2 pb-1">
            {[
              { value: "all", label: "Tutti" },
              { value: "pending", label: "In Attesa" },
              { value: "confirmed", label: "Confermati" },
              { value: "in_production", label: "In Produz." },
              { value: "shipped", label: "Spediti" },
              { value: "delivered", label: "Consegnati" },
            ].map((tab) => (
              <Button
                key={tab.value}
                variant={statusFilter === tab.value ? "default" : "outline"}
                size="sm"
                className="shrink-0 text-xs"
                onClick={() => setStatusFilter(tab.value)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </ScrollArea>

        {/* Orders List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Truck className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nessun ordine trovato</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredOrders.map((order) => {
              const sc = statusConfig[order.production_status] || statusConfig.pending;
              const StatusIcon = sc.icon;
              const itemCount = order.purchase_order_items?.length || 0;

              return (
                <button
                  key={order.id}
                  onClick={() => openDetail(order)}
                  className="w-full text-left bg-white rounded-xl border p-4 hover:shadow-md active:scale-[0.98] transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{order.number}</span>
                        {order.priority && (
                          <Badge className={`${priorityConfig[order.priority]?.color || ""} text-[10px] px-1.5 py-0`}>
                            {priorityConfig[order.priority]?.label || order.priority}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{order.suppliers?.name}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(order.order_date).toLocaleDateString("it-IT")}
                        </span>
                        <span>{itemCount} material{itemCount !== 1 ? "i" : "e"}</span>
                      </div>
                      {order.estimated_delivery_date && (
                        <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Consegna: {new Date(order.estimated_delivery_date).toLocaleDateString("it-IT")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`${sc.color} border text-[10px] shrink-0`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {sc.label}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
