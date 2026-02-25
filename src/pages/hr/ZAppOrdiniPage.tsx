import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search, ShoppingCart, ChevronRight, Package, Truck, Wrench } from "lucide-react";

interface Order {
  id: string;
  number: string;
  order_date: string | null;
  delivery_date: string | null;
  status: string | null;
  order_type: string | null;
  notes: string | null;
  customers?: { name: string; code: string } | null;
  work_orders?: Array<{ id: string; number: string; status: string }>;
  service_work_orders?: Array<{ id: string; number: string; status: string }>;
  shipping_orders?: Array<{ id: string; number: string; status: string }>;
}

const statusColors: Record<string, string> = {
  commissionato: "bg-blue-100 text-blue-800",
  in_lavorazione: "bg-amber-100 text-amber-800",
  completato: "bg-green-100 text-green-800",
};

const statusLabels: Record<string, string> = {
  commissionato: "Commissionato",
  in_lavorazione: "In Lavorazione",
  completato: "Completato",
};

const typeLabels: Record<string, string> = {
  odl: "CdL",
  odp: "CdP",
  odpel: "CdP+L",
  ods: "CdS",
};

const typeIcons: Record<string, any> = {
  odl: Wrench,
  odp: Package,
  odpel: Package,
  ods: Truck,
};

export default function ZAppOrdiniPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("sales_orders")
        .select(`
          id, number, order_date, delivery_date, status, order_type, notes,
          customers(name, code),
          work_orders(id, number, status),
          service_work_orders(id, number, status),
          shipping_orders(id, number, status)
        `)
        .eq("archived", false)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setOrders((data || []) as unknown as Order[]);
    } catch (error) {
      console.error("Error loading orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(o => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      o.number?.toLowerCase().includes(term) ||
      o.customers?.name?.toLowerCase().includes(term) ||
      o.customers?.code?.toLowerCase().includes(term) ||
      o.notes?.toLowerCase().includes(term)
    );
  });

  const getSubOrders = (order: Order) => {
    const subs: Array<{ type: string; number: string; status: string }> = [];
    order.work_orders?.forEach(wo => subs.push({ type: "Produzione", number: wo.number, status: wo.status }));
    order.service_work_orders?.forEach(so => subs.push({ type: "Lavoro", number: so.number, status: so.status }));
    order.shipping_orders?.forEach(sh => subs.push({ type: "Spedizione", number: sh.number, status: sh.status }));
    return subs;
  };

  if (selectedOrder) {
    const subs = getSubOrders(selectedOrder);
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="bg-teal-600 text-white px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setSelectedOrder(null)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">Ordine {selectedOrder.number}</h1>
              <p className="text-teal-100 text-sm">{selectedOrder.customers?.name || "—"}</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4 max-w-2xl mx-auto">
          {/* Info principali */}
          <div className="bg-white rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Stato</span>
              <Badge className={statusColors[selectedOrder.status || ""] || "bg-muted text-foreground"}>
                {statusLabels[selectedOrder.status || ""] || selectedOrder.status || "—"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tipo</span>
              <span className="text-sm font-medium">{typeLabels[selectedOrder.order_type || ""] || selectedOrder.order_type || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Data Ordine</span>
              <span className="text-sm">{selectedOrder.order_date ? new Date(selectedOrder.order_date).toLocaleDateString("it-IT") : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Consegna</span>
              <span className="text-sm">{selectedOrder.delivery_date ? new Date(selectedOrder.delivery_date).toLocaleDateString("it-IT") : "—"}</span>
            </div>
            {selectedOrder.notes && (
              <div>
                <span className="text-sm text-muted-foreground">Note</span>
                <p className="text-sm mt-1 bg-muted/50 p-2 rounded-lg">{selectedOrder.notes}</p>
              </div>
            )}
          </div>

          {/* Commesse collegate */}
          {subs.length > 0 && (
            <div className="bg-white rounded-xl border border-border p-4 space-y-3">
              <h3 className="font-semibold text-sm">Commesse Collegate</h3>
              {subs.map((sub, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{sub.number}</p>
                    <p className="text-xs text-muted-foreground">{sub.type}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{sub.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-teal-600 text-white px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate("/hr/z-app")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">Ordini</h1>
            <p className="text-teal-100 text-sm">{filteredOrders.length} ordini</p>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per numero, cliente..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Caricamento...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Nessun ordine trovato</div>
        ) : (
          <div className="space-y-2">
            {filteredOrders.map(order => {
              const TypeIcon = typeIcons[order.order_type || ""] || ShoppingCart;
              const subsCount = (order.work_orders?.length || 0) + (order.service_work_orders?.length || 0) + (order.shipping_orders?.length || 0);
              return (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border border-border hover:shadow-md active:scale-[0.98] transition-all text-left"
                >
                  <div className="h-10 w-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
                    <TypeIcon className="h-5 w-5 text-teal-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{order.number}</span>
                      <Badge className={`text-[10px] px-1.5 py-0 ${statusColors[order.status || ""] || "bg-muted text-foreground"}`}>
                        {statusLabels[order.status || ""] || order.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {order.customers?.name || "—"} • {typeLabels[order.order_type || ""] || order.order_type}
                      {subsCount > 0 && ` • ${subsCount} commesse`}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
