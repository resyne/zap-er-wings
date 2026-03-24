import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  ShoppingCart, Package, Truck, Wrench, Plus, Check, ChevronsUpDown, Loader2,
  Factory, Settings, Shield, MapPin, Building2, FileText, Trash2,
  CreditCard, Handshake, Euro
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateCustomerDialog } from "@/components/support/CreateCustomerDialog";

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

interface OrderItem {
  id: string;
  mode: "text" | "product" | "material" | "service";
  text: string;
  productId: string;
  materialId: string;
  serviceType: string;
  details: string;
  quantity: number;
}

interface PrefilledData {
  customer_id?: string;
  offer_id?: string;
  lead_id?: string;
  title?: string;
  description?: string;
  notes?: string;
}

interface CreateOrderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  prefilledData?: PrefilledData | null;
}

const SERVICE_TYPES = [
  { value: "manutenzione_straordinaria", label: "Manutenzione Straordinaria" },
  { value: "manutenzione_ordinaria", label: "Manutenzione Ordinaria" },
  { value: "altro", label: "Altro" },
];

const ORDER_TYPE_CATEGORIES = [
  { value: "fornitura", label: "Fornitura", icon: Factory, color: "text-amber-600 bg-amber-50 border-amber-200" },
  { value: "intervento", label: "Intervento", icon: Wrench, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { value: "ricambi", label: "Ricambi", icon: Settings, color: "text-purple-600 bg-purple-50 border-purple-200" },
];

const DELIVERY_MODES_FORNITURA = [
  { value: "produzione_spedizione", label: "Produzione e Spedizione", icon: Truck, desc: "Produzione + Spedizione" },
  { value: "produzione_installazione", label: "Produzione e Installazione", icon: MapPin, desc: "Produzione + Installazione" },
  { value: "ritiro", label: "Ritiro in sede", icon: Building2, desc: "Ritiro in sede" },
];

const DELIVERY_MODES_RICAMBI = [
  { value: "spedizione", label: "Spedizione", icon: Truck, desc: "Spedizione ricambi" },
  { value: "ritiro", label: "Ritiro in sede", icon: Building2, desc: "Ritiro ricambi in sede" },
];

export function CreateOrderSheet({ open, onOpenChange, onSuccess, prefilledData }: CreateOrderSheetProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);

  const [orderTypeCategory, setOrderTypeCategory] = useState("");
  const [isWarranty, setIsWarranty] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState("");
  const [smokeInlet, setSmokeInlet] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([
    { id: crypto.randomUUID(), mode: "text", text: "", productId: "", materialId: "", serviceType: "", details: "", quantity: 1 }
  ]);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentOnDelivery, setPaymentOnDelivery] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [agreements, setAgreements] = useState("");

  const [formData, setFormData] = useState({
    notes: "",
    order_date: new Date().toISOString().split("T")[0],
    delivery_date: "",
    deadline: "",
  });
  const [selectedPriority, setSelectedPriority] = useState("");
  const [saving, setSaving] = useState(false);

  const loadCustomers = useCallback(async () => {
    const { data } = await supabase.from("customers")
      .select("id, name, code, email, phone, company_name, address, city, province, postal_code, country, tax_id, pec, sdi_code, shipping_address")
      .eq("active", true).order("name");
    if (data) setCustomers(data as any);
  }, []);

  const loadProducts = useCallback(async () => {
    const { data } = await supabase.from("products")
      .select("id, name, code, product_type, requires_production, installation_possible, shipping_possible")
      .order("name");
    if (data) setProducts(data as unknown as Product[]);
  }, []);

  const loadMaterials = useCallback(async () => {
    const { data } = await supabase.from("materials").select("id, name, code").order("name");
    if (data) setMaterials(data as Material[]);
  }, []);

  // Initialize when opened
  useEffect(() => {
    if (!open) return;
    loadCustomers();
    loadProducts();
    loadMaterials();

    // Reset form
    setOrderTypeCategory("");
    setIsWarranty(false);
    setDeliveryMode("");
    setSmokeInlet("");
    setPaymentAmount("");
    setPaymentOnDelivery(false);
    setPaymentMethod("");
    setAgreements("");
    setSelectedPriority("");
    setSaving(false);
    setSelectedCustomer(null);
    setCustomerSearch("");

    if (prefilledData) {
      setFormData({
        notes: prefilledData.notes || "",
        order_date: new Date().toISOString().split("T")[0],
        delivery_date: "",
        deadline: "",
      });

      // Load customer
      if (prefilledData.customer_id) {
        supabase.from("customers")
          .select("id, name, code, email, phone, company_name, address, city, province, postal_code, country, tax_id, pec, sdi_code, shipping_address")
          .eq("id", prefilledData.customer_id).single()
          .then(({ data }) => { if (data) setSelectedCustomer(data as any); });
      }

      // Load offer items if offer_id
      if (prefilledData.offer_id) {
        supabase.from("offer_items")
          .select("product_id, description, product_name, quantity, products(name, code)")
          .eq("offer_id", prefilledData.offer_id)
          .then(({ data: offerItems }) => {
            if (offerItems && offerItems.length > 0) {
              const items: OrderItem[] = offerItems.map((oi: any) => {
                const hasProduct = !!oi.product_id;
                const textValue = oi.product_name || oi.description || "";
                return {
                  id: crypto.randomUUID(),
                  mode: hasProduct ? "product" as const : "text" as const,
                  text: hasProduct ? "" : textValue,
                  productId: oi.product_id || "",
                  materialId: "",
                  serviceType: "",
                  details: hasProduct ? (oi.description || "") : "",
                  quantity: oi.quantity || 1,
                };
              });
              setOrderItems(items);
            } else {
              setOrderItems([{
                id: crypto.randomUUID(),
                mode: "text",
                text: prefilledData.title || prefilledData.description || "",
                productId: "", materialId: "", serviceType: "", details: "", quantity: 1,
              }]);
            }
          });
      } else {
        setOrderItems([{
          id: crypto.randomUUID(),
          mode: "text",
          text: prefilledData.title || "",
          productId: "", materialId: "", serviceType: "", details: "", quantity: 1,
        }]);
      }
    } else {
      setFormData({ notes: "", order_date: new Date().toISOString().split("T")[0], delivery_date: "", deadline: "" });
      setOrderItems([{ id: crypto.randomUUID(), mode: "text", text: "", productId: "", materialId: "", serviceType: "", details: "", quantity: 1 }]);
    }
  }, [open, prefilledData, loadCustomers, loadProducts, loadMaterials]);

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

  const hasValidItems = orderItems.some(item => {
    if (item.mode === "text") return item.text.trim().length > 0;
    if (item.mode === "product") return !!item.productId;
    if (item.mode === "material") return !!item.materialId;
    if (item.mode === "service") return !!item.serviceType;
    return false;
  });

  const getItemLabel = (item: OrderItem) => {
    if (item.mode === "product") {
      const p = products.find(pr => pr.id === item.productId);
      return p ? `${p.code} - ${p.name}` : "";
    }
    if (item.mode === "material") {
      const m = materials.find(ma => ma.id === item.materialId);
      return m ? `${m.code} - ${m.name}` : "";
    }
    if (item.mode === "service") {
      const s = SERVICE_TYPES.find(st => st.value === item.serviceType);
      return s ? s.label : "";
    }
    return item.text;
  };

  const addOrderItem = () => {
    setOrderItems(prev => [...prev, { id: crypto.randomUUID(), mode: "text", text: "", productId: "", materialId: "", serviceType: "", details: "", quantity: 1 }]);
  };

  const removeOrderItem = (id: string) => {
    setOrderItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev);
  };

  const updateOrderItem = (id: string, updates: Partial<OrderItem>) => {
    setOrderItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const needsDeliveryMode = ["fornitura", "ricambi"].includes(orderTypeCategory);

  const availableDeliveryModes = useMemo(() => {
    if (orderTypeCategory === "ricambi") return DELIVERY_MODES_RICAMBI;
    return DELIVERY_MODES_FORNITURA;
  }, [orderTypeCategory]);

  const derivedInterventionType = useMemo(() => {
    if (orderTypeCategory !== "intervento") return "";
    const serviceItem = orderItems.find(i => i.mode === "service" && i.serviceType);
    if (!serviceItem) return "altro";
    if (serviceItem.serviceType.includes("manutenzione")) return "manutenzione";
    return "altro";
  }, [orderTypeCategory, orderItems]);

  const computeCommesse = () => {
    const commesse: string[] = [];
    if (orderTypeCategory === "fornitura") {
      commesse.push("Produzione");
      if (deliveryMode === "produzione_installazione") commesse.push("Installazione");
      if (deliveryMode === "produzione_spedizione") commesse.push("Spedizione");
    } else if (orderTypeCategory === "intervento") {
      const typeLabel = derivedInterventionType === "manutenzione" ? "Manutenzione" : "Intervento";
      commesse.push(`${typeLabel} (Lavoro)`);
    } else if (orderTypeCategory === "ricambi") {
      if (deliveryMode === "spedizione") commesse.push("Spedizione");
    }
    return commesse;
  };

  const canSubmit = () => {
    if (!selectedCustomer?.id || !orderTypeCategory) return false;
    if (needsDeliveryMode && !deliveryMode) return false;
    if (!hasValidItems) return false;
    return true;
  };

  const plannedCommesse = computeCommesse();

  const handleCreateOrder = async () => {
    if (!canSubmit()) return;
    setSaving(true);

    try {
      const customerName = selectedCustomer?.name || "Cliente";
      const subjectParts = orderItems
        .map(item => {
          const label = getItemLabel(item);
          if (!label) return null;
          let part = item.quantity > 1 ? `${label} (x${item.quantity})` : label;
          if (item.details.trim()) part += ` [${item.details.trim()}]`;
          return part;
        })
        .filter(Boolean);
      const subject = subjectParts.join(", ");
      const productName = subjectParts[0] || "";

      let orderType = "";
      const commesseToCreate = computeCommesse();
      const hasProd = commesseToCreate.some(c => c.includes("Produzione"));
      const hasLavoro = commesseToCreate.some(c => c.includes("Lavoro") || c.includes("Intervento"));
      if (hasProd && hasLavoro) orderType = "odpel";
      else if (hasProd) orderType = "odp";
      else if (hasLavoro) orderType = "odl";
      else orderType = "ods";

      const { data: salesOrder, error: soError } = await supabase
        .from("sales_orders")
        .insert([{
          number: "",
          customer_id: selectedCustomer!.id,
          order_date: formData.order_date || null,
          delivery_date: formData.delivery_date || null,
          deadline: formData.deadline || null,
          status: "commissionato",
          order_type: orderType,
          order_type_category: orderTypeCategory,
          delivery_mode: needsDeliveryMode ? deliveryMode : null,
          intervention_type: orderTypeCategory === "intervento" ? derivedInterventionType : null,
          is_warranty: isWarranty,
          order_subject: subject,
          total_amount: paymentAmount ? parseFloat(paymentAmount) : null,
          notes: [formData.notes, agreements ? `[Accordi] ${agreements}` : "", paymentOnDelivery ? "[Pagamento alla consegna]" : "", paymentMethod ? `[Pagamento: ${paymentMethod}]` : ""].filter(Boolean).join("\n") || null,
          order_source: "sale",
          offer_id: prefilledData?.offer_id || null,
          lead_id: prefilledData?.lead_id || null,
        }] as any)
        .select()
        .single();

      if (soError) throw soError;

      const phasesConfig = computeCommesse();
      let custData: any = null;
      if (phasesConfig.some(c => c === "Spedizione")) {
        const { data } = await supabase.from("customers")
          .select("city, province, address, shipping_address")
          .eq("id", selectedCustomer!.id).single();
        custData = data;
      }

      const commessaTitle = orderTypeCategory === "fornitura"
        ? `Fornitura ${subject || productName} per ${customerName}`.trim()
        : orderTypeCategory === "intervento"
        ? `${derivedInterventionType === "manutenzione" ? "Manutenzione" : "Intervento"} per ${customerName} - ${subject}`.trim()
        : `Ricambi per ${customerName}`.trim();

      const { data: commessa, error: commError } = await supabase
        .from("commesse")
        .insert([{
          number: "",
          sales_order_id: salesOrder.id,
          customer_id: selectedCustomer!.id,
          title: commessaTitle,
          description: subject || "",
          type: orderTypeCategory,
          delivery_mode: needsDeliveryMode ? deliveryMode : null,
          intervention_type: orderTypeCategory === "intervento" ? derivedInterventionType : null,
          priority: selectedPriority === "molto_urgente" ? "urgent" : selectedPriority === "urgente" ? "high" : selectedPriority === "normale" ? "low" : "medium",
          status: "da_fare",
          article: subject || null,
          notes: [formData.notes, agreements ? `[Accordi] ${agreements}` : "", paymentMethod ? `[Pagamento: ${paymentMethod}]` : ""].filter(Boolean).join("\n") || null,
          deadline: formData.deadline || null,
          shipping_address: custData?.shipping_address || custData?.address || null,
          shipping_city: custData?.city || null,
          shipping_province: custData?.province || null,
          is_warranty: isWarranty,
          lead_id: prefilledData?.lead_id || null,
          smoke_inlet: (orderTypeCategory === "fornitura" && smokeInlet) ? smokeInlet : null,
          payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
          payment_on_delivery: paymentOnDelivery,
        }] as any)
        .select()
        .single();
      if (commError) throw commError;

      const phases: Array<{ commessa_id: string; phase_type: string; phase_order: number; status: string }> = [];
      let phaseOrder = 1;
      for (const phase of phasesConfig) {
        const phaseType = phase === "Produzione" ? "produzione"
          : phase === "Spedizione" ? "spedizione"
          : phase === "Installazione" ? "installazione"
          : phase.includes("Manutenzione") ? "manutenzione"
          : phase.includes("Riparazione") ? "riparazione"
          : phase.includes("Intervento") ? "intervento"
          : "intervento";

        const initialStatus = phaseType === "spedizione" ? "da_preparare"
          : (phaseType === "installazione" || phaseType === "manutenzione" || phaseType === "riparazione") ? "da_programmare"
          : "da_fare";

        phases.push({ commessa_id: commessa.id, phase_type: phaseType, phase_order: phaseOrder++, status: initialStatus });
      }

      if (phases.length > 0) {
        const { error: phaseError } = await supabase.from("commessa_phases").insert(phases as any);
        if (phaseError) throw phaseError;
      }

      // Notifications (fire-and-forget)
      supabase.functions.invoke("notify-commessa-created", {
        body: { commessa_title: commessaTitle, commessa_type: orderTypeCategory, deadline: formData.deadline || null, customer_name: customerName },
      }).catch(console.error);

      supabase.functions.invoke("notify-nuovo-ordine", {
        body: { order_number: salesOrder.number, customer_name: customerName, total_amount: salesOrder.total_amount, order_date: formData.order_date || new Date().toISOString() },
      }).catch(console.error);

      // Archive offer if created from one
      if (prefilledData?.offer_id) {
        await supabase.from("offers").update({ status: "ordine_creato", archived: true }).eq("id", prefilledData.offer_id);
      }

      toast.success("Ordine creato con successo!");
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error creating order:", error);
      toast.error("Errore: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Sheet open={open && !showCreateCustomer} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
          <SheetHeader className="bg-teal-600 text-white px-6 py-4">
            <SheetTitle className="text-white text-lg">Crea Ordine</SheetTitle>
            {prefilledData?.offer_id && (
              <p className="text-teal-100 text-sm">Da offerta</p>
            )}
          </SheetHeader>

          <div className="p-4 space-y-3">
            {/* 1. Tipo Ordine */}
            <div className="bg-background rounded-xl border border-border p-4 space-y-3">
              <Label className="font-semibold text-sm">Tipo Ordine *</Label>
              <div className="grid grid-cols-2 gap-2">
                {ORDER_TYPE_CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  const isSelected = orderTypeCategory === cat.value;
                  return (
                    <button key={cat.value} type="button"
                      onClick={() => { setOrderTypeCategory(cat.value); setDeliveryMode(""); setIsWarranty(false); }}
                      className={cn("flex items-center gap-2 p-3 rounded-lg border-2 text-left transition-all text-sm font-medium",
                        isSelected ? cat.color + " border-current shadow-sm" : "border-border hover:bg-muted/50"
                      )}>
                      <Icon className="h-5 w-5 shrink-0" />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
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
                  <Popover open={customerOpen} onOpenChange={(o) => { setCustomerOpen(o); if (o && customers.length === 0) loadCustomers(); }}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox"
                        className={cn("flex-1 justify-between h-11 rounded-xl text-sm", selectedCustomer && "border-primary/30 bg-primary/5")}>
                        <span className="truncate">{selectedCustomer ? (selectedCustomer.company_name || selectedCustomer.name) : "Cerca cliente..."}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-0 z-[200]" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput placeholder="Cerca per nome, azienda, email..." value={customerSearch} onValueChange={setCustomerSearch} className="h-12" />
                        <CommandList>
                          <CommandEmpty>Nessun cliente trovato</CommandEmpty>
                          <CommandGroup className="max-h-60 overflow-auto">
                            {filteredCustomers.map(c => (
                              <CommandItem key={c.id} value={c.id}
                                onSelect={() => { setSelectedCustomer(c); setCustomerOpen(false); setCustomerSearch(""); }} className="py-3">
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
                      {selectedCustomer.address && <p className="text-muted-foreground">📍 {selectedCustomer.address}{selectedCustomer.city ? `, ${selectedCustomer.city}` : ''}{selectedCustomer.province ? ` (${selectedCustomer.province})` : ''}</p>}
                      {selectedCustomer.phone && <p className="text-muted-foreground">📞 {selectedCustomer.phone}</p>}
                      {selectedCustomer.email && <p className="text-muted-foreground">✉️ {selectedCustomer.email}</p>}
                      {selectedCustomer.tax_id && <p className="text-muted-foreground">🏷️ P.IVA/CF: {selectedCustomer.tax_id}</p>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. Voci dell'ordine */}
            {orderTypeCategory && selectedCustomer && (
              <div className="bg-background rounded-xl border-2 border-primary/20 p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ShoppingCart className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <Label className="font-semibold text-sm">Voci dell'ordine *</Label>
                      <p className="text-[10px] text-muted-foreground">{orderItems.length} {orderItems.length === 1 ? 'voce' : 'voci'}</p>
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addOrderItem}
                    className="h-8 text-xs gap-1.5 rounded-lg border-dashed border-primary/30 text-primary hover:bg-primary/5">
                    <Plus className="h-3.5 w-3.5" /> Aggiungi
                  </Button>
                </div>

                <div className="space-y-3">
                  {orderItems.map((item, idx) => {
                    const modeColors = { text: "border-l-blue-400", product: "border-l-amber-400", material: "border-l-purple-400", service: "border-l-emerald-400" };
                    return (
                      <div key={item.id} className={cn("border border-border border-l-4 rounded-xl p-3 space-y-2.5 bg-background relative transition-all hover:shadow-sm", modeColors[item.mode])}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">{idx + 1}</span>
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                              {item.mode === "text" ? "Testo libero" : item.mode === "product" ? "Prodotto" : item.mode === "material" ? "Materiale" : "Servizio"}
                            </span>
                          </div>
                          {orderItems.length > 1 && (
                            <button type="button" onClick={() => removeOrderItem(item.id)}
                              className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        {/* Mode selector */}
                        <div className="flex gap-1 bg-muted/60 rounded-lg p-0.5">
                          {([
                            { mode: "text" as const, icon: FileText, label: "Testo" },
                            { mode: "product" as const, icon: Package, label: "Prodotto" },
                            { mode: "material" as const, icon: Settings, label: "Materiale" },
                            { mode: "service" as const, icon: Wrench, label: "Servizio" },
                          ] as const).map(opt => {
                            const isActive = item.mode === opt.mode;
                            return (
                              <button key={opt.mode} type="button"
                                onClick={() => updateOrderItem(item.id, { mode: opt.mode, ...(opt.mode !== "text" ? { text: "" } : {}), ...(opt.mode !== "product" ? { productId: "" } : {}), ...(opt.mode !== "material" ? { materialId: "" } : {}), ...(opt.mode !== "service" ? { serviceType: "" } : {}) })}
                                className={cn("flex-1 text-[10px] py-1.5 px-1 rounded-md transition-all flex items-center justify-center gap-1",
                                  isActive ? "bg-background shadow-sm font-semibold text-foreground" : "text-muted-foreground hover:text-foreground")}>
                                <opt.icon className="h-3 w-3" /> {opt.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Input based on mode */}
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <div className="flex-1">
                              {item.mode === "text" && (
                                <Textarea placeholder="Es: Forno rotativo mod. X..." value={item.text}
                                  onChange={e => updateOrderItem(item.id, { text: e.target.value })} className="text-sm min-h-[80px] resize-y" rows={3} />
                              )}
                              {item.mode === "product" && (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" className="w-full justify-between h-10 text-sm">
                                      {item.productId ? (() => { const p = products.find(pr => pr.id === item.productId); return p ? `${p.code} - ${p.name}` : "..."; })() : "Seleziona prodotto..."}
                                      <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-full p-0" align="start">
                                    <Command>
                                      <CommandInput placeholder="Cerca prodotto..." />
                                      <CommandList>
                                        <CommandEmpty>Nessun prodotto trovato</CommandEmpty>
                                        <CommandGroup>
                                          {products.map(p => (
                                            <CommandItem key={p.id} value={`${p.code} ${p.name}`} onSelect={() => updateOrderItem(item.id, { productId: p.id })}>
                                              <Check className={cn("mr-2 h-4 w-4", item.productId === p.id ? "opacity-100" : "opacity-0")} />
                                              <div><p className="font-medium text-sm">{p.name}</p><p className="text-xs text-muted-foreground">{p.code}</p></div>
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              )}
                              {item.mode === "material" && (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" className="w-full justify-between h-10 text-sm">
                                      {item.materialId ? (() => { const m = materials.find(ma => ma.id === item.materialId); return m ? `${m.code} - ${m.name}` : "..."; })() : "Seleziona materiale..."}
                                      <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-full p-0" align="start">
                                    <Command>
                                      <CommandInput placeholder="Cerca materiale..." />
                                      <CommandList>
                                        <CommandEmpty>Nessun materiale trovato</CommandEmpty>
                                        <CommandGroup>
                                          {materials.map(m => (
                                            <CommandItem key={m.id} value={`${m.code} ${m.name}`} onSelect={() => updateOrderItem(item.id, { materialId: m.id })}>
                                              <Check className={cn("mr-2 h-4 w-4", item.materialId === m.id ? "opacity-100" : "opacity-0")} />
                                              <div><p className="font-medium text-sm">{m.name}</p><p className="text-xs text-muted-foreground">{m.code}</p></div>
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              )}
                              {item.mode === "service" && (
                                <Select value={item.serviceType} onValueChange={val => updateOrderItem(item.id, { serviceType: val })}>
                                  <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Seleziona servizio..." /></SelectTrigger>
                                  <SelectContent>
                                    {SERVICE_TYPES.map(s => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                            {item.mode !== "service" && (
                              <div className="w-16 shrink-0">
                                <Label className="text-[10px] text-muted-foreground mb-0.5 block">Qtà</Label>
                                <Input type="number" min={1} value={item.quantity}
                                  onChange={e => updateOrderItem(item.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                                  className="h-10 text-sm text-center font-medium" />
                              </div>
                            )}
                          </div>
                          <Textarea placeholder="Dettagli aggiuntivi..." value={item.details}
                            onChange={e => updateOrderItem(item.id, { details: e.target.value })}
                            className="text-xs bg-muted/30 border-dashed min-h-[48px] resize-y" rows={2} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. Modalità di consegna */}
            {needsDeliveryMode && selectedCustomer && hasValidItems && (
              <div className="bg-background rounded-xl border border-border p-4 space-y-3">
                <Label className="font-semibold text-sm">Modalità di consegna *</Label>
                <div className="space-y-2">
                  {availableDeliveryModes.map(dm => {
                    const Icon = dm.icon;
                    const isSelected = deliveryMode === dm.value;
                    return (
                      <button key={dm.value} type="button" onClick={() => setDeliveryMode(dm.value)}
                        className={cn("w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all",
                          isSelected ? "border-teal-500 bg-teal-50 shadow-sm" : "border-border hover:bg-muted/50")}>
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

            {/* 4a. Ingresso Fumi */}
            {orderTypeCategory === "fornitura" && selectedCustomer && hasValidItems && (
              <div className="bg-background rounded-xl border border-border p-4 space-y-3">
                <Label className="font-semibold text-sm">Ingresso Fumi</Label>
                <p className="text-xs text-muted-foreground">Seleziona il lato dell'ingresso fumi (opzionale)</p>
                <div className="flex gap-3">
                  {[{ value: "sx", label: "← SX", desc: "Sinistra" }, { value: "dx", label: "DX →", desc: "Destra" }].map(opt => {
                    const isSelected = smokeInlet === opt.value;
                    return (
                      <button key={opt.value} type="button" onClick={() => setSmokeInlet(isSelected ? "" : opt.value)}
                        className={cn("flex-1 flex flex-col items-center gap-1 p-4 rounded-xl border-2 transition-all font-semibold",
                          isSelected ? "border-teal-500 bg-teal-50 text-teal-700 ring-1 ring-teal-500" : "border-border bg-muted/30 text-foreground hover:bg-muted")}>
                        <span className="text-lg">{opt.label}</span>
                        <span className="text-xs font-normal text-muted-foreground">{opt.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4b. Pagamento & Accordi */}
            {orderTypeCategory && selectedCustomer && hasValidItems && (
              <div className="bg-background rounded-xl border border-border p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <CreditCard className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <Label className="font-semibold text-sm">Pagamento & Accordi</Label>
                    <p className="text-[10px] text-muted-foreground">Condizioni economiche e accordi con il cliente</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Importo ordine (€)</Label>
                  <div className="relative">
                    <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="number" min={0} step="0.01" placeholder="0,00" value={paymentAmount}
                      onChange={e => setPaymentAmount(e.target.value)} className="pl-9 h-10 text-sm font-medium" />
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/50">
                  <div className="flex items-center gap-2.5">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Pagamento alla consegna</p>
                      <p className="text-[10px] text-muted-foreground">Il cliente paga al momento della consegna</p>
                    </div>
                  </div>
                  <Switch checked={paymentOnDelivery} onCheckedChange={setPaymentOnDelivery} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Metodo di pagamento</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Seleziona metodo..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bonifico">Bonifico Bancario</SelectItem>
                      <SelectItem value="contanti">Contanti</SelectItem>
                      <SelectItem value="assegno">Assegno</SelectItem>
                      <SelectItem value="carta">Carta di Credito/Debito</SelectItem>
                      <SelectItem value="riba">Ri.Ba.</SelectItem>
                      <SelectItem value="altro">Altro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Handshake className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-xs text-muted-foreground">Accordi con il cliente</Label>
                  </div>
                  <Textarea placeholder="Es: Acconto 30% alla conferma..." value={agreements}
                    onChange={e => setAgreements(e.target.value)} rows={2} className="text-sm" />
                </div>
              </div>
            )}

            {/* 5. Date */}
            {orderTypeCategory && selectedCustomer && (
              <div className="bg-background rounded-xl border border-border p-4">
                <Label className="text-xs text-muted-foreground">Data Ordine</Label>
                <Input type="date" value={formData.order_date} onChange={e => setFormData(p => ({ ...p, order_date: e.target.value }))} className="mt-1" />
              </div>
            )}

            {/* 5b. Scadenza e Priorità */}
            {orderTypeCategory && selectedCustomer && (
              <div className="bg-background rounded-xl border border-border p-4 space-y-3">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Scadenza Ordine</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "molto_urgente", label: "🔴 Molto Urgente", desc: "entro 24h", days: 1 },
                    { key: "urgente", label: "🟠 Urgente", desc: "entro 48h", days: 2 },
                    { key: "media", label: "🟡 Media", desc: "entro 5 gg", days: 5 },
                    { key: "normale", label: "🟢 Normale", desc: "entro 10 gg", days: 10 },
                  ].map(p => {
                    const isSelected = selectedPriority === p.key;
                    return (
                      <button key={p.key} type="button"
                        onClick={() => { setSelectedPriority(p.key); const d = new Date(); d.setDate(d.getDate() + p.days); setFormData(prev => ({ ...prev, deadline: d.toISOString().split("T")[0] })); }}
                        className={cn("px-3 py-2 rounded-lg border text-xs font-medium transition-all",
                          isSelected ? "border-teal-500 bg-teal-50 text-teal-700 ring-1 ring-teal-500" : "border-border bg-muted/30 text-foreground hover:bg-muted")}>
                        <div>{p.label}</div>
                        <div className="text-[10px] text-muted-foreground">{p.desc}</div>
                      </button>
                    );
                  })}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Oppure scegli data scadenza</Label>
                  <Input type="date" value={formData.deadline} onChange={e => { setFormData(p => ({ ...p, deadline: e.target.value })); setSelectedPriority(""); }} className="mt-1" />
                </div>
              </div>
            )}

            {/* 6. Note */}
            {orderTypeCategory && selectedCustomer && (
              <div className="bg-background rounded-xl border border-border p-4 space-y-2">
                <Label className="text-xs text-muted-foreground">Note interne</Label>
                <Textarea placeholder="Note sull'ordine..." value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} rows={2} />
              </div>
            )}

            {/* 7. Preview commesse */}
            {plannedCommesse.length > 0 && canSubmit() && (
              <div className="bg-teal-50 rounded-xl border border-teal-200 p-4 space-y-2">
                <p className="text-xs font-semibold text-teal-700">Commesse che verranno create automaticamente:</p>
                <div className="flex flex-wrap gap-2">
                  {plannedCommesse.map((c, i) => (
                    <Badge key={i} variant="outline" className="bg-white text-teal-700 border-teal-300 text-xs">{c}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pb-4">
              <Button variant="outline" className="flex-1 h-11" onClick={() => onOpenChange(false)}>Annulla</Button>
              <Button onClick={handleCreateOrder} disabled={saving || !canSubmit()}
                className="flex-1 h-11 bg-teal-600 hover:bg-teal-700">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Crea Ordine
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <CreateCustomerDialog
        open={showCreateCustomer}
        onOpenChange={setShowCreateCustomer}
        onCustomerCreated={(newCustomer) => {
          setSelectedCustomer(newCustomer as any);
          setShowCreateCustomer(false);
          loadCustomers();
        }}
      />
    </>
  );
}
