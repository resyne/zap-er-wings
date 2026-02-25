import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import {
  ArrowLeft, Search, ShoppingCart, ChevronRight, Package, Truck, Wrench,
  Plus, Check, ChevronsUpDown, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

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

interface Customer {
  id: string;
  name: string;
  code: string;
  company_name?: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  commissionato: "bg-blue-100 text-blue-800",
  in_lavorazione: "bg-amber-100 text-amber-800",
  in_progress: "bg-amber-100 text-amber-800",
  completato: "bg-green-100 text-green-800",
  completed: "bg-green-100 text-green-800",
};

const statusLabels: Record<string, string> = {
  draft: "Bozza",
  commissionato: "Commissionato",
  in_lavorazione: "In Lavorazione",
  in_progress: "In Lavorazione",
  completato: "Completato",
  completed: "Completato",
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

type ViewMode = "list" | "detail" | "create";

export default function ZAppOrdiniPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Create form state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [formData, setFormData] = useState({
    notes: "",
    order_date: new Date().toISOString().split("T")[0],
    delivery_date: "",
  });
  const [commesse, setCommesse] = useState({
    produzione: false,
    lavoro: false,
    spedizione: false,
  });
  const [saving, setSaving] = useState(false);

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

  const loadCustomers = async () => {
    // @ts-ignore - Supabase type instantiation too deep
    const { data } = await supabase
      .from("customers")
      .select("id, name, code, company_name")
      .eq("is_active", true)
      .order("name");
    if (data) setCustomers(data as any);
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

  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  );

  const openCreateForm = () => {
    loadCustomers();
    setSelectedCustomerId("");
    setFormData({ notes: "", order_date: new Date().toISOString().split("T")[0], delivery_date: "" });
    setCommesse({ produzione: false, lavoro: false, spedizione: false });
    setViewMode("create");
  };

  const handleCreateOrder = async () => {
    if (!selectedCustomerId) { toast.error("Seleziona un cliente"); return; }
    if (!commesse.produzione && !commesse.lavoro && !commesse.spedizione) {
      toast.error("Seleziona almeno un tipo di commessa");
      return;
    }

    setSaving(true);
    try {
      // Determine order type
      let orderType = "";
      if (commesse.produzione && commesse.lavoro) orderType = "odpel";
      else if (commesse.produzione) orderType = "odp";
      else if (commesse.lavoro) orderType = "odl";
      else if (commesse.spedizione) orderType = "ods";

      const customerName = selectedCustomer?.name || "Cliente";

      // 1. Create sales order
      const { data: salesOrder, error: soError } = await supabase
        .from("sales_orders")
        .insert([{
          number: "",
          customer_id: selectedCustomerId,
          order_date: formData.order_date || null,
          delivery_date: formData.delivery_date || null,
          status: "commissionato",
          order_type: orderType,
          notes: formData.notes || null,
          order_source: "sale",
        }] as any)
        .select()
        .single();

      if (soError) throw soError;

      const createdCommesse: string[] = [];

      // 2. Create production work order
      if (commesse.produzione) {
        const { data: wo, error } = await supabase
          .from("work_orders")
          .insert([{
            number: "",
            title: `Produzione per ${customerName}`,
            description: formData.notes || "",
            status: "da_fare",
            customer_id: selectedCustomerId,
            sales_order_id: salesOrder.id,
            priority: "medium",
            notes: formData.notes || null,
          }])
          .select()
          .single();
        if (error) throw error;
        if (wo) createdCommesse.push(`CdP: ${wo.number}`);
      }

      // 3. Create service work order
      if (commesse.lavoro) {
        const { data: swo, error } = await supabase
          .from("service_work_orders")
          .insert([{
            number: "",
            title: `Lavoro per ${customerName}`,
            description: formData.notes || "",
            status: "da_programmare",
            customer_id: selectedCustomerId,
            sales_order_id: salesOrder.id,
            priority: "medium",
            notes: formData.notes || null,
          }])
          .select()
          .single();
        if (error) throw error;
        if (swo) createdCommesse.push(`CdL: ${swo.number}`);
      }

      // 4. Create shipping order
      if (commesse.spedizione) {
        // Get customer address
        const { data: custData } = await supabase
          .from("customers")
          .select("city, province, address, shipping_address")
          .eq("id", selectedCustomerId)
          .single();

        const { data: so, error } = await supabase
          .from("shipping_orders")
          .insert([{
            number: "",
            customer_id: selectedCustomerId,
            status: "da_preparare",
            order_date: formData.order_date || new Date().toISOString().split("T")[0],
            notes: formData.notes || null,
            sales_order_id: salesOrder.id,
            shipping_address: custData?.shipping_address || custData?.address || null,
            shipping_city: custData?.city || null,
            shipping_province: custData?.province || null,
          }])
          .select()
          .single();
        if (error) throw error;
        if (so) createdCommesse.push(`CdS: ${so.number}`);
      }

      toast.success(`Ordine ${salesOrder.number} creato!\n${createdCommesse.join(" • ")}`);
      setViewMode("list");
      loadOrders();
    } catch (error: any) {
      console.error("Error creating order:", error);
      toast.error("Errore: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  // ===== CREATE VIEW =====
  if (viewMode === "create") {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="bg-teal-600 text-white px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setViewMode("list")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">Nuovo Ordine</h1>
              <p className="text-teal-100 text-sm">Crea ordine con commesse</p>
            </div>
          </div>
        </div>

        <div className="p-4 max-w-2xl mx-auto space-y-4">
          {/* Cliente */}
          <div className="bg-white rounded-xl border border-border p-4 space-y-3">
            <Label className="font-semibold text-sm">Cliente *</Label>
            <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between h-11">
                  {selectedCustomer
                    ? `${selectedCustomer.name} (${selectedCustomer.code})`
                    : "Seleziona cliente..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Cerca cliente..." />
                  <CommandList>
                    <CommandEmpty>Nessun cliente trovato</CommandEmpty>
                    <CommandGroup>
                      {customers.map(c => (
                        <CommandItem
                          key={c.id}
                          value={`${c.name} ${c.company_name || ""} ${c.code}`}
                          onSelect={() => { setSelectedCustomerId(c.id); setCustomerOpen(false); }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedCustomerId === c.id ? "opacity-100" : "opacity-0")} />
                          <div>
                            <p className="font-medium text-sm">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.code}</p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Date */}
          <div className="bg-white rounded-xl border border-border p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Data Ordine</Label>
                <Input
                  type="date"
                  value={formData.order_date}
                  onChange={e => setFormData(p => ({ ...p, order_date: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Data Consegna</Label>
                <Input
                  type="date"
                  value={formData.delivery_date}
                  onChange={e => setFormData(p => ({ ...p, delivery_date: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Tipo Commesse */}
          <div className="bg-white rounded-xl border border-border p-4 space-y-3">
            <Label className="font-semibold text-sm">Commesse da creare *</Label>
            <div className="space-y-3 mt-2">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors">
                <Checkbox
                  checked={commesse.produzione}
                  onCheckedChange={v => setCommesse(p => ({ ...p, produzione: !!v }))}
                />
                <Package className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-medium text-sm">Commessa di Produzione</p>
                  <p className="text-xs text-muted-foreground">Ordine di produzione (CdP)</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors">
                <Checkbox
                  checked={commesse.lavoro}
                  onCheckedChange={v => setCommesse(p => ({ ...p, lavoro: !!v }))}
                />
                <Wrench className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-sm">Commessa di Lavoro</p>
                  <p className="text-xs text-muted-foreground">Installazione / Intervento (CdL)</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors">
                <Checkbox
                  checked={commesse.spedizione}
                  onCheckedChange={v => setCommesse(p => ({ ...p, spedizione: !!v }))}
                />
                <Truck className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-sm">Commessa di Spedizione</p>
                  <p className="text-xs text-muted-foreground">Ordine di spedizione (CdS)</p>
                </div>
              </label>
            </div>
          </div>

          {/* Note */}
          <div className="bg-white rounded-xl border border-border p-4 space-y-2">
            <Label className="text-xs text-muted-foreground">Note</Label>
            <Textarea
              placeholder="Note sull'ordine..."
              value={formData.notes}
              onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Submit */}
          <Button
            onClick={handleCreateOrder}
            disabled={saving || !selectedCustomerId || (!commesse.produzione && !commesse.lavoro && !commesse.spedizione)}
            className="w-full h-12 text-base font-semibold bg-teal-600 hover:bg-teal-700"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Plus className="h-5 w-5 mr-2" />}
            Crea Ordine con Commesse
          </Button>
        </div>
      </div>
    );
  }

  // ===== DETAIL VIEW =====
  if (viewMode === "detail" && selectedOrder) {
    const subs = getSubOrders(selectedOrder);
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="bg-teal-600 text-white px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => { setSelectedOrder(null); setViewMode("list"); }}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">Ordine {selectedOrder.number}</h1>
              <p className="text-teal-100 text-sm">{selectedOrder.customers?.name || "—"}</p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4 max-w-2xl mx-auto">
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

  // ===== LIST VIEW =====
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="bg-teal-600 text-white px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate("/hr/z-app")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Ordini</h1>
            <p className="text-teal-100 text-sm">{filteredOrders.length} ordini</p>
          </div>
          <Button
            size="icon"
            className="bg-white/20 hover:bg-white/30 text-white h-10 w-10 rounded-xl"
            onClick={openCreateForm}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-3">
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
          <div className="text-center py-12 text-muted-foreground">
            <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Nessun ordine trovato</p>
            <Button variant="outline" className="mt-3" onClick={openCreateForm}>
              <Plus className="h-4 w-4 mr-2" /> Crea il primo ordine
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredOrders.map(order => {
              const TypeIcon = typeIcons[order.order_type || ""] || ShoppingCart;
              const subsCount = (order.work_orders?.length || 0) + (order.service_work_orders?.length || 0) + (order.shipping_orders?.length || 0);
              return (
                <button
                  key={order.id}
                  onClick={() => { setSelectedOrder(order); setViewMode("detail"); }}
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
