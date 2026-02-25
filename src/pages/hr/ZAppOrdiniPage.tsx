import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import {
  ArrowLeft, Search, ShoppingCart, ChevronRight, Package, Truck, Wrench,
  Plus, Check, ChevronsUpDown, Loader2, Factory, Settings, Shield, Zap,
  MapPin, Building2, FileText, Pencil
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateCustomerDialog } from "@/components/support/CreateCustomerDialog";

interface Order {
  id: string;
  number: string;
  order_date: string | null;
  delivery_date: string | null;
  status: string | null;
  order_type: string | null;
  order_type_category: string | null;
  delivery_mode: string | null;
  notes: string | null;
  order_subject: string | null;
  customers?: { name: string; code: string } | null;
  work_orders?: Array<{ id: string; number: string; status: string }>;
  service_work_orders?: Array<{ id: string; number: string; status: string }>;
  shipping_orders?: Array<{ id: string; number: string; status: string }>;
}

interface Customer {
  id: string;
  name: string;
  code: string;
  email?: string;
  phone?: string;
  company_name?: string;
  address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
  tax_id?: string;
  pec?: string;
  sdi_code?: string;
  shipping_address?: string;
}

interface Product {
  id: string;
  name: string;
  code: string;
  product_type: string;
  requires_production: boolean;
  installation_possible: boolean;
  shipping_possible: boolean;
}

interface Material {
  id: string;
  name: string;
  code: string;
}

const ORDER_TYPE_CATEGORIES = [
  { value: "produzione", label: "Produzione", icon: Factory, color: "text-amber-600 bg-amber-50 border-amber-200" },
  { value: "intervento", label: "Intervento", icon: Wrench, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { value: "ricambi", label: "Ricambi", icon: Settings, color: "text-purple-600 bg-purple-50 border-purple-200" },
  { value: "installazione", label: "Installazione", icon: MapPin, color: "text-green-600 bg-green-50 border-green-200" },
  { value: "misto", label: "Misto", icon: Zap, color: "text-orange-600 bg-orange-50 border-orange-200" },
];

const DELIVERY_MODES = [
  { value: "installazione", label: "Installazione presso cliente", icon: MapPin, desc: "Produzione + Installazione" },
  { value: "spedizione", label: "Spedizione", icon: Truck, desc: "Produzione + Spedizione" },
  { value: "ritiro", label: "Ritiro in sede", icon: Building2, desc: "Solo Produzione" },
];

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

const categoryLabels: Record<string, string> = {
  produzione: "Produzione",
  intervento: "Intervento",
  ricambi: "Ricambi",
  installazione: "Installazione",
  misto: "Misto",
};

type ViewMode = "list" | "detail";

export default function ZAppOrdiniPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create form state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [materialOpen, setMaterialOpen] = useState(false);

  const [orderTypeCategory, setOrderTypeCategory] = useState("");
  const [isWarranty, setIsWarranty] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState("");
  const [subjectMode, setSubjectMode] = useState<"text" | "product" | "material">("text");
  const [orderSubject, setOrderSubject] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedMaterialId, setSelectedMaterialId] = useState("");

  const [formData, setFormData] = useState({
    notes: "",
    order_date: new Date().toISOString().split("T")[0],
    delivery_date: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadOrders(); }, []);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("sales_orders")
        .select(`
          id, number, order_date, delivery_date, status, order_type, order_type_category, delivery_mode, notes, order_subject,
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
    // @ts-ignore
    const { data } = await supabase.from("customers")
      .select("id, name, code, email, phone, company_name, address, city, province, postal_code, country, tax_id, pec, sdi_code, shipping_address")
      .eq("is_active", true)
      .order("name");
    if (data) setCustomers(data as any);
  };

  const loadProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name, code, product_type, requires_production, installation_possible, shipping_possible")
      .order("name");
    if (data) setProducts(data as unknown as Product[]);
  };

  const loadMaterials = async () => {
    const { data } = await supabase.from("materials").select("id, name, code").order("name");
    if (data) setMaterials(data as Material[]);
  };

  const filteredOrders = orders.filter(o => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      o.number?.toLowerCase().includes(term) ||
      o.customers?.name?.toLowerCase().includes(term) ||
      o.customers?.code?.toLowerCase().includes(term) ||
      o.notes?.toLowerCase().includes(term) ||
      o.order_subject?.toLowerCase().includes(term)
    );
  });

  const getSubOrders = (order: Order) => {
    const subs: Array<{ type: string; number: string; status: string }> = [];
    order.work_orders?.forEach(wo => subs.push({ type: "Produzione", number: wo.number, status: wo.status }));
    order.service_work_orders?.forEach(so => subs.push({ type: "Intervento/Installazione", number: so.number, status: so.status }));
    order.shipping_orders?.forEach(sh => subs.push({ type: "Spedizione", number: sh.number, status: sh.status }));
    return subs;
  };

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const s = customerSearch.toLowerCase();
    return customers.filter(c =>
      (c.name || '').toLowerCase().includes(s) ||
      (c.company_name || '').toLowerCase().includes(s) ||
      (c.email || '').toLowerCase().includes(s) ||
      (c.phone || '').toLowerCase().includes(s) ||
      (c.code || '').toLowerCase().includes(s)
    );
  }, [customers, customerSearch]);
  const selectedProduct = useMemo(() => products.find(p => p.id === selectedProductId), [products, selectedProductId]);
  const selectedMaterial = useMemo(() => materials.find(m => m.id === selectedMaterialId), [materials, selectedMaterialId]);

  // Determine if delivery mode is needed (only for types that involve a physical product)
  const needsDeliveryMode = ["produzione", "ricambi", "misto"].includes(orderTypeCategory);
  // For intervento, it's always service work order
  // For installazione, it's always production + installation
  const needsProductSelection = ["produzione", "ricambi", "installazione", "misto"].includes(orderTypeCategory);

  // Available delivery modes based on selected product capabilities
  const availableDeliveryModes = useMemo(() => {
    if (!selectedProduct) return DELIVERY_MODES;
    return DELIVERY_MODES.filter(dm => {
      if (dm.value === "installazione") return selectedProduct.installation_possible;
      if (dm.value === "spedizione") return selectedProduct.shipping_possible;
      return true; // ritiro always available
    });
  }, [selectedProduct]);

  const openCreateForm = () => {
    loadCustomers();
    loadProducts();
    loadMaterials();
    setSelectedCustomer(null);
    setCustomerSearch("");
    setOrderTypeCategory("");
    setIsWarranty(false);
    setDeliveryMode("");
    setSubjectMode("text");
    setOrderSubject("");
    setSelectedProductId("");
    setSelectedMaterialId("");
    setFormData({ notes: "", order_date: new Date().toISOString().split("T")[0], delivery_date: "" });
    setSaving(false);
    setShowCreateForm(true);
  };

  // Compute what commesse will be auto-created
  const computeCommesse = () => {
    const commesse: string[] = [];

    if (orderTypeCategory === "produzione") {
      commesse.push("Produzione");
      if (deliveryMode === "installazione") commesse.push("Installazione");
      if (deliveryMode === "spedizione") commesse.push("Spedizione");
    } else if (orderTypeCategory === "intervento") {
      commesse.push("Intervento (Lavoro)");
    } else if (orderTypeCategory === "ricambi") {
      if (deliveryMode === "spedizione") commesse.push("Spedizione");
      if (deliveryMode === "installazione") commesse.push("Installazione");
      // ricambi may not need production if from stock
    } else if (orderTypeCategory === "installazione") {
      commesse.push("Produzione");
      commesse.push("Installazione");
    } else if (orderTypeCategory === "misto") {
      commesse.push("Produzione");
      commesse.push("Intervento (Lavoro)");
      if (deliveryMode === "installazione") commesse.push("Installazione");
      if (deliveryMode === "spedizione") commesse.push("Spedizione");
    }

    return commesse;
  };

  const canSubmit = () => {
    if (!selectedCustomer?.id || !orderTypeCategory) return false;
    if (needsDeliveryMode && !deliveryMode) return false;
    // Need either text subject or product/material selection
    if (subjectMode === "text" && !orderSubject.trim()) return false;
    if (subjectMode === "product" && !selectedProductId) return false;
    if (subjectMode === "material" && !selectedMaterialId) return false;
    return true;
  };

  const handleCreateOrder = async () => {
    if (!canSubmit()) return;
    setSaving(true);

    try {
      const customerName = selectedCustomer?.name || "Cliente";
      const productName = selectedProduct?.name || selectedMaterial?.name || orderSubject || "";
      const subject = subjectMode === "product" ? `${selectedProduct?.code} - ${selectedProduct?.name}`
        : subjectMode === "material" ? `${selectedMaterial?.code} - ${selectedMaterial?.name}`
        : orderSubject;

      // Determine order_type for backward compatibility
      let orderType = "";
      const commesseToCreate = computeCommesse();
      const hasProd = commesseToCreate.some(c => c.includes("Produzione"));
      const hasLavoro = commesseToCreate.some(c => c.includes("Lavoro") || c.includes("Intervento"));
      if (hasProd && hasLavoro) orderType = "odpel";
      else if (hasProd) orderType = "odp";
      else if (hasLavoro) orderType = "odl";
      else orderType = "ods";

      // 1. Create sales order
      const { data: salesOrder, error: soError } = await supabase
        .from("sales_orders")
        .insert([{
          number: "",
           customer_id: selectedCustomer!.id,
          order_date: formData.order_date || null,
          delivery_date: formData.delivery_date || null,
          status: "commissionato",
          order_type: orderType,
          order_type_category: orderTypeCategory,
          delivery_mode: needsDeliveryMode ? deliveryMode : (orderTypeCategory === "installazione" ? "installazione" : null),
          is_warranty: isWarranty,
          order_subject: subject,
          notes: formData.notes || null,
          order_source: "sale",
        }] as any)
        .select()
        .single();

      if (soError) throw soError;
      const createdCommesse: string[] = [];

      // 2. Auto-create commesse based on type + delivery mode
      // Production
      if (commesseToCreate.some(c => c === "Produzione")) {
        const { data: wo, error } = await supabase
          .from("work_orders")
          .insert([{
            number: "",
            title: `Produzione ${productName} per ${customerName}`.trim(),
            description: subject || "",
            status: "da_fare",
             customer_id: selectedCustomer!.id,
            sales_order_id: salesOrder.id,
            priority: "medium",
            notes: formData.notes || null,
          }])
          .select()
          .single();
        if (error) throw error;
        if (wo) createdCommesse.push(`Produzione: ${wo.number}`);
      }

      // Service/Intervento/Installation work order
      if (commesseToCreate.some(c => c.includes("Intervento") || c.includes("Installazione"))) {
        const isInstallation = commesseToCreate.some(c => c.includes("Installazione"));
        const { data: swo, error } = await supabase
          .from("service_work_orders")
          .insert([{
            number: "",
            title: `${isInstallation ? "Installazione" : "Intervento"} ${productName} per ${customerName}`.trim(),
            description: subject || "",
            status: "da_programmare",
             customer_id: selectedCustomer!.id,
            sales_order_id: salesOrder.id,
            priority: "medium",
            notes: formData.notes || null,
          }])
          .select()
          .single();
        if (error) throw error;
        if (swo) createdCommesse.push(`${isInstallation ? "Installazione" : "Intervento"}: ${swo.number}`);
      }

      // Shipping
      if (commesseToCreate.some(c => c === "Spedizione")) {
        const { data: custData } = await supabase
          .from("customers")
          .select("city, province, address, shipping_address")
          .eq("id", selectedCustomer!.id)
          .single();

        const { data: so, error } = await supabase
          .from("shipping_orders")
          .insert([{
            number: "",
            customer_id: selectedCustomer!.id,
            status: "da_preparare",
            order_date: formData.order_date || new Date().toISOString().split("T")[0],
            notes: `${subject ? "Oggetto: " + subject + ". " : ""}${formData.notes || ""}`.trim() || null,
            sales_order_id: salesOrder.id,
            shipping_address: custData?.shipping_address || custData?.address || null,
            shipping_city: custData?.city || null,
            shipping_province: custData?.province || null,
          }])
          .select()
          .single();
        if (error) throw error;
        if (so) createdCommesse.push(`Spedizione: ${so.number}`);
      }

      toast.success(`Ordine ${salesOrder.number} creato!\n${createdCommesse.join(" • ")}`);
      setShowCreateForm(false);
      loadOrders();
    } catch (error: any) {
      console.error("Error creating order:", error);
      toast.error("Errore: " + error.message);
    } finally {
      setSaving(false);
    }
  };

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
            {selectedOrder.order_type_category && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Tipo Ordine</span>
                <span className="text-sm font-medium">{categoryLabels[selectedOrder.order_type_category] || selectedOrder.order_type_category}</span>
              </div>
            )}
            {selectedOrder.delivery_mode && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Consegna</span>
                <span className="text-sm font-medium capitalize">{selectedOrder.delivery_mode}</span>
              </div>
            )}
            {selectedOrder.order_subject && (
              <div>
                <span className="text-sm text-muted-foreground">Oggetto</span>
                <p className="text-sm mt-1 font-medium">{selectedOrder.order_subject}</p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Data Ordine</span>
              <span className="text-sm">{selectedOrder.order_date ? new Date(selectedOrder.order_date).toLocaleDateString("it-IT") : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Consegna Prevista</span>
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
  const plannedCommesse = computeCommesse();

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
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-3">
        {/* Nuovo Ordine */}
        {!showCreateForm ? (
          <Button onClick={openCreateForm} className="w-full h-12 text-base font-semibold bg-teal-600 hover:bg-teal-700 rounded-xl">
            <Plus className="h-5 w-5 mr-2" /> Nuovo Ordine
          </Button>
        ) : (
          <div className="space-y-3">
            {/* 1. Tipo Ordine */}
            <div className="bg-white rounded-xl border border-border p-4 space-y-3">
              <Label className="font-semibold text-sm">Tipo Ordine *</Label>
              <div className="grid grid-cols-2 gap-2">
                {ORDER_TYPE_CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  const isSelected = orderTypeCategory === cat.value;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => {
                        setOrderTypeCategory(cat.value);
                        setDeliveryMode("");
                        setIsWarranty(false);
                      }}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-lg border-2 text-left transition-all text-sm font-medium",
                        isSelected ? cat.color + " border-current shadow-sm" : "border-border hover:bg-muted/50"
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
              {/* Warranty toggle for Ricambi */}
              {orderTypeCategory === "ricambi" && (
                <label className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200 cursor-pointer">
                  <Shield className="h-5 w-5 text-amber-600" />
                  <span className="text-sm font-medium flex-1">In garanzia</span>
                  <Switch checked={isWarranty} onCheckedChange={setIsWarranty} />
                </label>
              )}
            </div>

            {/* 2. Cliente */}
            {orderTypeCategory && (
              <div className="bg-background rounded-xl border border-border p-4 space-y-3">
                <Label className="font-semibold text-sm">Cliente *</Label>
                <div className="flex gap-2">
                  <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn("flex-1 justify-between h-11 rounded-xl text-sm", selectedCustomer && "border-primary/30 bg-primary/5")}
                      >
                        <span className="truncate">{selectedCustomer ? (selectedCustomer.company_name || selectedCustomer.name) : "Cerca cliente..."}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[calc(100vw-3rem)] p-0 z-[200]" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput placeholder="Cerca per nome, azienda, email, telefono..." value={customerSearch} onValueChange={setCustomerSearch} className="h-12" />
                        <CommandList>
                          <CommandEmpty>Nessun cliente trovato</CommandEmpty>
                          <CommandGroup className="max-h-60 overflow-auto">
                            {filteredCustomers.map(c => (
                              <CommandItem
                                key={c.id}
                                value={c.id}
                                onSelect={() => { setSelectedCustomer(c); setCustomerOpen(false); setCustomerSearch(""); }}
                                className="py-3"
                              >
                                <Check className={cn("mr-2 h-4 w-4 shrink-0", selectedCustomer?.id === c.id ? "opacity-100" : "opacity-0")} />
                                <div className="flex flex-col min-w-0">
                                  <span className="font-medium truncate">{c.company_name || c.name}</span>
                                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                                    {c.company_name && <span>{c.name}</span>}
                                    {c.email && <span>✉️ {c.email}</span>}
                                    {c.phone && <span>📞 {c.phone}</span>}
                                    {c.city && <span>📍 {c.city}</span>}
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-xl" onClick={() => setShowCreateCustomer(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {selectedCustomer && (
                  <div className="bg-muted/50 rounded-xl p-3 text-xs space-y-1.5 border">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-foreground truncate">{selectedCustomer.company_name || selectedCustomer.name}</p>
                        {selectedCustomer.company_name && <p className="text-muted-foreground">{selectedCustomer.name}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-1 pt-1 border-t border-border/50">
                      {selectedCustomer.address && (
                        <p className="text-muted-foreground">📍 {selectedCustomer.address}{selectedCustomer.city ? `, ${selectedCustomer.city}` : ''}{selectedCustomer.province ? ` (${selectedCustomer.province})` : ''}</p>
                      )}
                      {selectedCustomer.phone && <p className="text-muted-foreground">📞 {selectedCustomer.phone}</p>}
                      {selectedCustomer.email && <p className="text-muted-foreground">✉️ {selectedCustomer.email}</p>}
                      {selectedCustomer.tax_id && <p className="text-muted-foreground">🏷️ P.IVA/CF: {selectedCustomer.tax_id}</p>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. Oggetto dell'ordine */}
            {orderTypeCategory && selectedCustomer && (
              <div className="bg-white rounded-xl border border-border p-4 space-y-3">
                <Label className="font-semibold text-sm">Oggetto dell'ordine *</Label>
                <div className="flex gap-1 bg-muted rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => { setSubjectMode("text"); setSelectedProductId(""); setSelectedMaterialId(""); }}
                    className={cn("flex-1 text-xs py-2 px-3 rounded-md transition-all flex items-center justify-center gap-1", subjectMode === "text" ? "bg-white shadow-sm font-medium" : "text-muted-foreground")}
                  >
                    <FileText className="h-3.5 w-3.5" /> Testo
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSubjectMode("product"); setOrderSubject(""); setSelectedMaterialId(""); }}
                    className={cn("flex-1 text-xs py-2 px-3 rounded-md transition-all flex items-center justify-center gap-1", subjectMode === "product" ? "bg-white shadow-sm font-medium" : "text-muted-foreground")}
                  >
                    <Package className="h-3.5 w-3.5" /> Prodotto
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSubjectMode("material"); setOrderSubject(""); setSelectedProductId(""); }}
                    className={cn("flex-1 text-xs py-2 px-3 rounded-md transition-all flex items-center justify-center gap-1", subjectMode === "material" ? "bg-white shadow-sm font-medium" : "text-muted-foreground")}
                  >
                    <Settings className="h-3.5 w-3.5" /> Materiale
                  </button>
                </div>

                {subjectMode === "text" && (
                  <Input
                    placeholder="Es: Forno rotativo mod. X per panificio..."
                    value={orderSubject}
                    onChange={e => setOrderSubject(e.target.value)}
                    className="h-11"
                  />
                )}

                {subjectMode === "product" && (
                  <Popover open={productOpen} onOpenChange={setProductOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between h-11">
                        {selectedProduct ? `${selectedProduct.code} - ${selectedProduct.name}` : "Seleziona prodotto..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Cerca prodotto..." />
                        <CommandList>
                          <CommandEmpty>Nessun prodotto trovato</CommandEmpty>
                          <CommandGroup>
                            {products.map(p => (
                              <CommandItem key={p.id} value={`${p.code} ${p.name}`} onSelect={() => { setSelectedProductId(p.id); setProductOpen(false); setDeliveryMode(""); }}>
                                <Check className={cn("mr-2 h-4 w-4", selectedProductId === p.id ? "opacity-100" : "opacity-0")} />
                                <div>
                                  <p className="font-medium text-sm">{p.name}</p>
                                  <p className="text-xs text-muted-foreground">{p.code}</p>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}

                {subjectMode === "material" && (
                  <Popover open={materialOpen} onOpenChange={setMaterialOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between h-11">
                        {selectedMaterial ? `${selectedMaterial.code} - ${selectedMaterial.name}` : "Seleziona materiale..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Cerca materiale..." />
                        <CommandList>
                          <CommandEmpty>Nessun materiale trovato</CommandEmpty>
                          <CommandGroup>
                            {materials.map(m => (
                              <CommandItem key={m.id} value={`${m.code} ${m.name}`} onSelect={() => { setSelectedMaterialId(m.id); setMaterialOpen(false); }}>
                                <Check className={cn("mr-2 h-4 w-4", selectedMaterialId === m.id ? "opacity-100" : "opacity-0")} />
                                <div>
                                  <p className="font-medium text-sm">{m.name}</p>
                                  <p className="text-xs text-muted-foreground">{m.code}</p>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            )}

            {/* 4. Modalità di consegna (only for types that need it) */}
            {needsDeliveryMode && selectedCustomer && (subjectMode === "text" ? orderSubject.trim() : (selectedProductId || selectedMaterialId)) && (
              <div className="bg-white rounded-xl border border-border p-4 space-y-3">
                <Label className="font-semibold text-sm">Modalità di consegna *</Label>
                <div className="space-y-2">
                  {availableDeliveryModes.map(dm => {
                    const Icon = dm.icon;
                    const isSelected = deliveryMode === dm.value;
                    return (
                      <button
                        key={dm.value}
                        type="button"
                        onClick={() => setDeliveryMode(dm.value)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all",
                          isSelected ? "border-teal-500 bg-teal-50 shadow-sm" : "border-border hover:bg-muted/50"
                        )}
                      >
                        <Icon className={cn("h-5 w-5 shrink-0", isSelected ? "text-teal-600" : "text-muted-foreground")} />
                        <div className="flex-1">
                          <p className={cn("text-sm font-medium", isSelected && "text-teal-700")}>{dm.label}</p>
                          <p className="text-xs text-muted-foreground">{dm.desc}</p>
                        </div>
                        {isSelected && <Check className="h-5 w-5 text-teal-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. Date */}
            {orderTypeCategory && selectedCustomer && (
              <div className="bg-white rounded-xl border border-border p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Data Ordine</Label>
                    <Input type="date" value={formData.order_date} onChange={e => setFormData(p => ({ ...p, order_date: e.target.value }))} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Data Consegna</Label>
                    <Input type="date" value={formData.delivery_date} onChange={e => setFormData(p => ({ ...p, delivery_date: e.target.value }))} className="mt-1" />
                  </div>
                </div>
              </div>
            )}

            {/* 6. Note */}
            {orderTypeCategory && selectedCustomer && (
              <div className="bg-white rounded-xl border border-border p-4 space-y-2">
                <Label className="text-xs text-muted-foreground">Note</Label>
                <Textarea placeholder="Note sull'ordine..." value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} rows={2} />
              </div>
            )}

            {/* 7. Preview commesse auto-generate */}
            {plannedCommesse.length > 0 && canSubmit() && (
              <div className="bg-teal-50 rounded-xl border border-teal-200 p-4 space-y-2">
                <p className="text-xs font-semibold text-teal-700">Commesse che verranno create automaticamente:</p>
                <div className="flex flex-wrap gap-2">
                  {plannedCommesse.map((c, i) => (
                    <Badge key={i} variant="outline" className="bg-white text-teal-700 border-teal-300 text-xs">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-11" onClick={() => setShowCreateForm(false)}>Annulla</Button>
              <Button
                onClick={handleCreateOrder}
                disabled={saving || !canSubmit()}
                className="flex-1 h-11 bg-teal-600 hover:bg-teal-700"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Crea Ordine
              </Button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca per numero, cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 bg-white" />
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
              const catIcon = ORDER_TYPE_CATEGORIES.find(c => c.value === order.order_type_category)?.icon || ShoppingCart;
              const CatIcon = catIcon;
              const subsCount = (order.work_orders?.length || 0) + (order.service_work_orders?.length || 0) + (order.shipping_orders?.length || 0);
              return (
                <button
                  key={order.id}
                  onClick={() => { setSelectedOrder(order); setViewMode("detail"); }}
                  className="w-full flex items-center gap-3 p-4 bg-white rounded-xl border border-border hover:shadow-md active:scale-[0.98] transition-all text-left"
                >
                  <div className="h-10 w-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
                    <CatIcon className="h-5 w-5 text-teal-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{order.number}</span>
                      <Badge className={`text-[10px] px-1.5 py-0 ${statusColors[order.status || ""] || "bg-muted text-foreground"}`}>
                        {statusLabels[order.status || ""] || order.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {order.customers?.name || "—"}
                      {order.order_type_category && ` • ${categoryLabels[order.order_type_category] || order.order_type_category}`}
                      {subsCount > 0 && ` • ${subsCount} commesse`}
                    </p>
                    {order.order_subject && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{order.order_subject}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <CreateCustomerDialog
        open={showCreateCustomer}
        onOpenChange={setShowCreateCustomer}
        onCustomerCreated={(newCustomer: Customer) => {
          setCustomers(prev => [...prev, newCustomer]);
          setSelectedCustomer(newCustomer);
          setShowCreateCustomer(false);
        }}
      />
    </div>
  );
}
