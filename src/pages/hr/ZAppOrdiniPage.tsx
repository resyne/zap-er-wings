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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ArrowLeft, Search, ShoppingCart, ChevronRight, Package, Truck, Wrench,
  Plus, Check, ChevronsUpDown, Loader2, Factory, Settings, Shield, Zap,
  MapPin, Building2, FileText, Pencil, Trash2, Save, FileCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateCustomerDialog } from "@/components/support/CreateCustomerDialog";
import { useUserRole } from "@/hooks/useUserRole";

interface AcceptedOffer {
  id: string;
  number: string;
  title: string;
  description?: string;
  customer_id?: string;
  customer_name?: string;
  lead_id?: string;
  customers?: { name: string; code: string } | null;
}

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
  commesse?: Array<{ id: string; number: string; status: string; type: string }>;
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

const INTERVENTION_TYPES = [
  { value: "manutenzione", label: "Manutenzione", icon: Wrench, desc: "Manutenzione programmata o preventiva" },
  { value: "riparazione", label: "Riparazione", icon: Settings, desc: "Riparazione guasto o malfunzionamento" },
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
  fornitura: "Fornitura",
  produzione: "Fornitura", // backward compat for old orders
  intervento: "Intervento",
  ricambi: "Ricambi",
  installazione: "Installazione", // backward compat for old orders
};

type ViewMode = "list" | "detail";

export default function ZAppOrdiniPage() {
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ notes: "", order_subject: "", status: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [acceptedOffers, setAcceptedOffers] = useState<AcceptedOffer[]>([]);

  // Create form state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);

  const [orderTypeCategory, setOrderTypeCategory] = useState("");
  const [interventionType, setInterventionType] = useState("");
  const [isWarranty, setIsWarranty] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([
    { id: crypto.randomUUID(), mode: "text", text: "", productId: "", materialId: "", serviceType: "", details: "", quantity: 1 }
  ]);

  const [formData, setFormData] = useState({
    notes: "",
    order_date: new Date().toISOString().split("T")[0],
    delivery_date: "",
    deadline: "",
  });
  const [selectedPriority, setSelectedPriority] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedOfferIdForOrder, setSelectedOfferIdForOrder] = useState<string | null>(null);
  const [selectedLeadIdForOrder, setSelectedLeadIdForOrder] = useState<string | null>(null);

  useEffect(() => { loadOrders(); loadAcceptedOffers(); }, []);

  const loadAcceptedOffers = async () => {
    try {
      const { data, error } = await supabase
        .from("offers")
        .select("id, number, title, description, customer_id, customer_name, lead_id, customers(name, code)")
        .eq("status", "accettata")
        .eq("archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setAcceptedOffers((data || []) as unknown as AcceptedOffer[]);
    } catch (error) {
      console.error("Error loading accepted offers:", error);
    }
  };

  const handleCreateOrderFromOffer = async (offer: AcceptedOffer) => {
    // Pre-fill the create form with offer data
    loadCustomers();
    loadProducts();
    loadMaterials();
    // Find customer from offer
    const custId = offer.customer_id;
    if (custId) {
      supabase.from("customers")
        .select("id, name, code, email, phone, company_name, address, city, province, postal_code, country, tax_id, pec, sdi_code, shipping_address")
        .eq("id", custId)
        .single()
        .then(({ data }) => {
          if (data) setSelectedCustomer(data as any);
        });
    }
    setSelectedOfferIdForOrder(offer.id);
    setSelectedLeadIdForOrder(offer.lead_id || null);
    setOrderTypeCategory("fornitura");
    setInterventionType("");
    setIsWarranty(false);
    setDeliveryMode("");

    // Load offer items (products) from offer_items table
    const { data: offerItems } = await supabase
      .from("offer_items")
      .select("product_id, description, product_name, quantity, products(name, code)")
      .eq("offer_id", offer.id);

    if (offerItems && offerItems.length > 0) {
      const items: OrderItem[] = offerItems.map((oi: any) => {
        const hasProduct = !!oi.product_id;
        // For text items, use product_name first (custom text entries), then description
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
        text: offer.title || offer.description || "",
        productId: "",
        materialId: "",
        serviceType: "",
        details: "",
        quantity: 1,
      }]);
    }

    setFormData({
      notes: `Da offerta ${offer.number}`,
      order_date: new Date().toISOString().split("T")[0],
      delivery_date: "",
      deadline: "",
    });
    setSelectedPriority("");
    setSaving(false);
    setShowCreateForm(true);
  };

  const handleDismissOffer = async (offerId: string) => {
    try {
      const { error } = await supabase.from("offers").update({ archived: true }).eq("id", offerId);
      if (error) throw error;
      setAcceptedOffers(prev => prev.filter(o => o.id !== offerId));
      toast.success("Offerta archiviata");
    } catch (err: any) {
      toast.error("Errore: " + err.message);
    }
  };

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("sales_orders")
        .select(`
          id, number, order_date, delivery_date, status, order_type, order_type_category, delivery_mode, notes, order_subject,
          customers(name, code),
          commesse(id, number, status, type)
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
    const { data } = await supabase.from("customers")
      .select("id, name, code, email, phone, company_name, address, city, province, postal_code, country, tax_id, pec, sdi_code, shipping_address")
      .eq("active", true)
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
    return (order.commesse || []).map(c => ({
      type: c.type === 'fornitura' ? 'Fornitura' : c.type === 'intervento' ? 'Intervento' : 'Ricambi',
      number: c.number,
      status: c.status,
    }));
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
  const needsInterventionType = orderTypeCategory === "intervento";
  

  const availableDeliveryModes = useMemo(() => {
    if (orderTypeCategory === "ricambi") return DELIVERY_MODES_RICAMBI;
    return DELIVERY_MODES_FORNITURA;
  }, [orderTypeCategory]);

  const openCreateForm = () => {
    loadCustomers();
    loadProducts();
    loadMaterials();
    setSelectedCustomer(null);
    setCustomerSearch("");
    setOrderTypeCategory("");
    setInterventionType("");
    setIsWarranty(false);
    setDeliveryMode("");
    setOrderItems([{ id: crypto.randomUUID(), mode: "text", text: "", productId: "", materialId: "", serviceType: "", details: "", quantity: 1 }]);
    setFormData({ notes: "", order_date: new Date().toISOString().split("T")[0], delivery_date: "", deadline: "" });
    setSelectedPriority("");
    setSelectedOfferIdForOrder(null);
    setSelectedLeadIdForOrder(null);
    setSaving(false);
    setShowCreateForm(true);
  };

  // Compute what commesse will be auto-created
  const computeCommesse = () => {
    const commesse: string[] = [];

    if (orderTypeCategory === "fornitura") {
      commesse.push("Produzione");
      if (deliveryMode === "produzione_installazione") commesse.push("Installazione");
      if (deliveryMode === "produzione_spedizione") commesse.push("Spedizione");
    } else if (orderTypeCategory === "intervento") {
      const typeLabel = interventionType === "manutenzione" ? "Manutenzione" : interventionType === "riparazione" ? "Riparazione" : "Intervento";
      commesse.push(`${typeLabel} (Lavoro)`);
    } else if (orderTypeCategory === "ricambi") {
      if (deliveryMode === "spedizione") commesse.push("Spedizione");
    }

    return commesse;
  };

  const canSubmit = () => {
    if (!selectedCustomer?.id || !orderTypeCategory) return false;
    if (needsDeliveryMode && !deliveryMode) return false;
    if (needsInterventionType && !interventionType) return false;
    if (!hasValidItems) return false;
    return true;
  };

  const handleCreateOrder = async () => {
    if (!canSubmit()) return;
    setSaving(true);

    try {
      const customerName = selectedCustomer?.name || "Cliente";
      // Build combined subject from all items
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
          deadline: formData.deadline || null,
          status: "commissionato",
          order_type: orderType,
          order_type_category: orderTypeCategory,
          delivery_mode: needsDeliveryMode ? deliveryMode : null,
          intervention_type: orderTypeCategory === "intervento" ? interventionType : null,
          is_warranty: isWarranty,
          order_subject: subject,
          notes: formData.notes || null,
          order_source: "sale",
          offer_id: selectedOfferIdForOrder || null,
          lead_id: selectedLeadIdForOrder || null,
        }] as any)
        .select()
        .single();

      if (soError) throw soError;
      // 2. Create single commessa with phases
      const phasesConfig = computeCommesse();
      
      // Get customer shipping data if needed
      let custData: any = null;
      if (phasesConfig.some(c => c === "Spedizione")) {
        const { data } = await supabase
          .from("customers")
          .select("city, province, address, shipping_address")
          .eq("id", selectedCustomer!.id)
          .single();
        custData = data;
      }

      const commessaTitle = orderTypeCategory === "fornitura"
        ? `Fornitura ${productName} per ${customerName}`.trim()
        : orderTypeCategory === "intervento"
        ? `${interventionType === "manutenzione" ? "Manutenzione" : "Riparazione"} per ${customerName}`.trim()
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
          intervention_type: orderTypeCategory === "intervento" ? interventionType : null,
          priority: selectedPriority === "molto_urgente" ? "urgent" : selectedPriority === "urgente" ? "high" : selectedPriority === "normale" ? "low" : "medium",
          status: "da_fare",
          article: subject || null,
          notes: formData.notes || null,
          deadline: formData.deadline || null,
          shipping_address: custData?.shipping_address || custData?.address || null,
          shipping_city: custData?.city || null,
          shipping_province: custData?.province || null,
          is_warranty: isWarranty,
          lead_id: selectedLeadIdForOrder || null,
        }] as any)
        .select()
        .single();
      if (commError) throw commError;

      // 3. Create phases
      const phases: Array<{ commessa_id: string; phase_type: string; phase_order: number; status: string }> = [];
      let order = 1;
      for (const phase of phasesConfig) {
        const phaseType = phase === "Produzione" ? "produzione"
          : phase === "Spedizione" ? "spedizione"
          : phase === "Installazione" ? "installazione"
          : phase.includes("Manutenzione") ? "manutenzione"
          : phase.includes("Riparazione") ? "riparazione"
          : "produzione";
        
        const initialStatus = phaseType === "spedizione" ? "da_preparare"
          : (phaseType === "installazione" || phaseType === "manutenzione" || phaseType === "riparazione") ? "da_programmare"
          : "da_fare";

        phases.push({
          commessa_id: commessa.id,
          phase_type: phaseType,
          phase_order: order++,
          status: initialStatus,
        });
      }

      if (phases.length > 0) {
        const { error: phaseError } = await supabase.from("commessa_phases").insert(phases as any);
        if (phaseError) throw phaseError;
      }

      const phaseLabels = phasesConfig.join(" → ");

      // Notify technicians via WhatsApp (fire-and-forget)
      supabase.functions.invoke("notify-commessa-created", {
        body: {
          commessa_title: commessaTitle,
          commessa_type: orderTypeCategory,
          deadline: formData.deadline || null,
          customer_name: customerName,
        },
      }).then(res => {
        if (res.error) console.error("Commessa notification error:", res.error);
      });

      // Notify about new sales order (fire-and-forget)
      supabase.functions.invoke("notify-nuovo-ordine", {
        body: {
          order_number: salesOrder.number,
          customer_name: customerName,
          total_amount: salesOrder.total_amount,
          order_date: formData.order_date || new Date().toISOString(),
        },
      }).then(res => {
        if (res.error) console.error("Order notification error:", res.error);
      });

      // Archive offer if created from one
      if (selectedOfferIdForOrder) {
        await supabase.from("offers").update({ archived: true }).eq("id", selectedOfferIdForOrder);
        setSelectedOfferIdForOrder(null);
        setSelectedLeadIdForOrder(null);
      }

      setShowCreateForm(false);
      loadOrders();
      loadAcceptedOffers();
    } catch (error: any) {
      console.error("Error creating order:", error);
      toast.error("Errore: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  // ===== Admin handlers =====
  const startEditing = () => {
    if (!selectedOrder) return;
    setEditData({
      notes: selectedOrder.notes || "",
      order_subject: selectedOrder.order_subject || "",
      status: selectedOrder.status || "commissionato",
    });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedOrder) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase.from("sales_orders")
        .update({
          notes: editData.notes || null,
          order_subject: editData.order_subject || null,
          status: editData.status,
        })
        .eq("id", selectedOrder.id);
      if (error) throw error;
      const updated = { ...selectedOrder, notes: editData.notes || null, order_subject: editData.order_subject || null, status: editData.status };
      setSelectedOrder(updated);
      setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
      setIsEditing(false);
      toast.success("Ordine aggiornato");
    } catch (err: any) {
      toast.error("Errore: " + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!deleteOrderId) return;
    setDeleting(true);
    try {
      // Delete related commesse phases first, then commesse, then the order
      const { data: relatedCommesse } = await supabase.from("commesse").select("id").eq("sales_order_id", deleteOrderId);
      if (relatedCommesse && relatedCommesse.length > 0) {
        const commessaIds = relatedCommesse.map(c => c.id);
        await supabase.from("commessa_phases").delete().in("commessa_id", commessaIds);
        await supabase.from("commessa_communications").delete().in("commessa_id", commessaIds);
        await supabase.from("commesse").delete().eq("sales_order_id", deleteOrderId);
      }
      const { error } = await supabase.from("sales_orders").delete().eq("id", deleteOrderId);
      if (error) throw error;
      setOrders(prev => prev.filter(o => o.id !== deleteOrderId));
      setDeleteOrderId(null);
      setSelectedOrder(null);
      setViewMode("list");
      toast.success("Ordine eliminato");
    } catch (err: any) {
      toast.error("Errore: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  // ===== DETAIL VIEW =====
  if (viewMode === "detail" && selectedOrder) {
    const subs = getSubOrders(selectedOrder);
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="bg-teal-600 text-white px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => { setSelectedOrder(null); setViewMode("list"); setIsEditing(false); }}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-lg font-bold">Ordine {selectedOrder.number}</h1>
              <p className="text-teal-100 text-sm">{selectedOrder.customers?.name || "—"}</p>
            </div>
            {isAdmin && !isEditing && (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={startEditing}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="text-white hover:bg-red-500/30" onClick={() => setDeleteOrderId(selectedOrder.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
            {isAdmin && isEditing && (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 text-xs" onClick={() => setIsEditing(false)}>Annulla</Button>
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 text-xs" onClick={handleSaveEdit} disabled={savingEdit}>
                  {savingEdit ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                  Salva
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 space-y-4 max-w-2xl mx-auto">
          <div className="bg-white rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Stato</span>
              {isEditing ? (
                <Select value={editData.status} onValueChange={v => setEditData(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="commissionato">Commissionato</SelectItem>
                    <SelectItem value="in_lavorazione">In Lavorazione</SelectItem>
                    <SelectItem value="in_progress">In Lavorazione</SelectItem>
                    <SelectItem value="completato">Completato</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Badge className={statusColors[selectedOrder.status || ""] || "bg-muted text-foreground"}>
                  {statusLabels[selectedOrder.status || ""] || selectedOrder.status || "—"}
                </Badge>
              )}
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
            {isEditing ? (
              <div>
                <span className="text-sm text-muted-foreground">Oggetto</span>
                <Input value={editData.order_subject} onChange={e => setEditData(p => ({ ...p, order_subject: e.target.value }))} className="mt-1 text-sm" />
              </div>
            ) : selectedOrder.order_subject ? (
              <div>
                <span className="text-sm text-muted-foreground">Oggetto</span>
                <p className="text-sm mt-1 font-medium">{selectedOrder.order_subject}</p>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Data Ordine</span>
              <span className="text-sm">{selectedOrder.order_date ? new Date(selectedOrder.order_date).toLocaleDateString("it-IT") : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Consegna Prevista</span>
              <span className="text-sm">{selectedOrder.delivery_date ? new Date(selectedOrder.delivery_date).toLocaleDateString("it-IT") : "—"}</span>
            </div>
            {isEditing ? (
              <div>
                <span className="text-sm text-muted-foreground">Note</span>
                <Textarea value={editData.notes} onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))} rows={3} className="mt-1 text-sm" />
              </div>
            ) : selectedOrder.notes ? (
              <div>
                <span className="text-sm text-muted-foreground">Note</span>
                <p className="text-sm mt-1 bg-muted/50 p-2 rounded-lg">{selectedOrder.notes}</p>
              </div>
            ) : null}
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

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteOrderId} onOpenChange={(o) => !o && setDeleteOrderId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Elimina Ordine</AlertDialogTitle>
              <AlertDialogDescription>
                Sei sicuro di voler eliminare questo ordine e tutte le commesse collegate? Questa azione non può essere annullata.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteOrder} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleting ? "Eliminazione..." : "Elimina"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
                        setInterventionType("");
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
                  <Popover open={customerOpen} onOpenChange={(open) => { setCustomerOpen(open); if (open && customers.length === 0) loadCustomers(); }}>
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

            {/* 3. Voci dell'ordine (multi-item) */}
            {orderTypeCategory && selectedCustomer && (
              <div className="bg-white rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold text-sm">Voci dell'ordine *</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={addOrderItem} className="h-7 text-xs gap-1">
                    <Plus className="h-3.5 w-3.5" /> Aggiungi voce
                  </Button>
                </div>

                {orderItems.map((item, idx) => (
                  <div key={item.id} className="border border-border rounded-lg p-3 space-y-2 relative">
                    {orderItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeOrderItem(item.id)}
                        className="absolute top-2 right-2 text-muted-foreground hover:text-destructive text-xs"
                      >
                        ✕
                      </button>
                    )}
                    <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Voce {idx + 1}</p>
                    
                    {/* Mode selector */}
                    <div className="flex gap-1 bg-muted rounded-lg p-1">
                      <button type="button" onClick={() => updateOrderItem(item.id, { mode: "text", productId: "", materialId: "", serviceType: "" })}
                        className={cn("flex-1 text-[10px] py-1.5 px-1 rounded-md transition-all flex items-center justify-center gap-0.5", item.mode === "text" ? "bg-white shadow-sm font-medium" : "text-muted-foreground")}>
                        <FileText className="h-3 w-3" /> Testo
                      </button>
                      <button type="button" onClick={() => updateOrderItem(item.id, { mode: "product", text: "", materialId: "", serviceType: "" })}
                        className={cn("flex-1 text-[10px] py-1.5 px-1 rounded-md transition-all flex items-center justify-center gap-0.5", item.mode === "product" ? "bg-white shadow-sm font-medium" : "text-muted-foreground")}>
                        <Package className="h-3 w-3" /> Prodotto
                      </button>
                      <button type="button" onClick={() => updateOrderItem(item.id, { mode: "material", text: "", productId: "", serviceType: "" })}
                        className={cn("flex-1 text-[10px] py-1.5 px-1 rounded-md transition-all flex items-center justify-center gap-0.5", item.mode === "material" ? "bg-white shadow-sm font-medium" : "text-muted-foreground")}>
                        <Settings className="h-3 w-3" /> Materiale
                      </button>
                      <button type="button" onClick={() => updateOrderItem(item.id, { mode: "service", text: "", productId: "", materialId: "" })}
                        className={cn("flex-1 text-[10px] py-1.5 px-1 rounded-md transition-all flex items-center justify-center gap-0.5", item.mode === "service" ? "bg-white shadow-sm font-medium" : "text-muted-foreground")}>
                        <Wrench className="h-3 w-3" /> Servizio
                      </button>
                    </div>

                    {/* Input based on mode */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        {item.mode === "text" && (
                          <Input placeholder="Es: Forno rotativo mod. X..." value={item.text}
                            onChange={e => updateOrderItem(item.id, { text: e.target.value })} className="h-10 text-sm" />
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
                        {item.mode === "service" && (
                          <Select value={item.serviceType} onValueChange={val => updateOrderItem(item.id, { serviceType: val })}>
                            <SelectTrigger className="h-10 text-sm">
                              <SelectValue placeholder="Seleziona servizio..." />
                            </SelectTrigger>
                            <SelectContent>
                              {SERVICE_TYPES.map(s => (
                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      {item.mode !== "service" && (
                        <div className="w-16">
                          <Input type="number" min={1} value={item.quantity}
                            onChange={e => updateOrderItem(item.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="h-10 text-sm text-center" placeholder="Qtà" />
                        </div>
                      )}
                    </div>

                    {/* Details field */}
                    <Input placeholder="Dettagli aggiuntivi (opzionale)..." value={item.details}
                      onChange={e => updateOrderItem(item.id, { details: e.target.value })}
                      className="h-9 text-xs" />
                  </div>
                ))}
              </div>
            )}

            {/* 4. Modalità di consegna (only for types that need it) */}
            {needsDeliveryMode && selectedCustomer && hasValidItems && (
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


            {/* 4b. Tipo di intervento (only for intervento) */}
            {needsInterventionType && selectedCustomer && hasValidItems && (
              <div className="bg-background rounded-xl border border-border p-4 space-y-3">
                <Label className="font-semibold text-sm">Tipo di intervento *</Label>
                <div className="space-y-2">
                  {INTERVENTION_TYPES.map(it => {
                    const Icon = it.icon;
                    const isSelected = interventionType === it.value;
                    return (
                      <button
                        key={it.value}
                        type="button"
                        onClick={() => setInterventionType(it.value)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all",
                          isSelected ? "border-teal-500 bg-teal-50 shadow-sm" : "border-border hover:bg-muted/50"
                        )}
                      >
                        <Icon className={cn("h-5 w-5 shrink-0", isSelected ? "text-teal-600" : "text-muted-foreground")} />
                        <div className="flex-1">
                          <p className={cn("text-sm font-medium", isSelected && "text-teal-700")}>{it.label}</p>
                          <p className="text-xs text-muted-foreground">{it.desc}</p>
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
                <div>
                  <Label className="text-xs text-muted-foreground">Data Ordine</Label>
                  <Input type="date" value={formData.order_date} onChange={e => setFormData(p => ({ ...p, order_date: e.target.value }))} className="mt-1" />
                </div>
              </div>
            )}

            {/* 5b. Scadenza e Priorità */}
            {orderTypeCategory && selectedCustomer && (
              <div className="bg-white rounded-xl border border-border p-4 space-y-3">
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
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => {
                          setSelectedPriority(p.key);
                          const d = new Date();
                          d.setDate(d.getDate() + p.days);
                          setFormData(prev => ({ ...prev, deadline: d.toISOString().split("T")[0] }));
                        }}
                        className={cn(
                          "px-3 py-2 rounded-lg border text-xs font-medium transition-all",
                          isSelected ? "border-teal-500 bg-teal-50 text-teal-700 ring-1 ring-teal-500" : "border-border bg-muted/30 text-foreground hover:bg-muted"
                        )}
                      >
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

        {/* Offerte Accettate */}
        {!showCreateForm && acceptedOffers.length > 0 && (
          <div className="bg-white rounded-xl border-2 border-green-200 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-sm">Offerte Accettate ({acceptedOffers.length})</h3>
            </div>
            <p className="text-xs text-muted-foreground">Trasforma un'offerta accettata in ordine</p>
            <div className="space-y-2">
              {acceptedOffers.map(offer => (
                <div key={offer.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{offer.title || offer.number}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {offer.number} • {offer.customers?.name || offer.customer_name || "—"}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-green-600 hover:bg-green-700"
                      onClick={() => handleCreateOrderFromOffer(offer)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Ordine
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDismissOffer(offer.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
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
              const subsCount = order.commesse?.length || 0;
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
