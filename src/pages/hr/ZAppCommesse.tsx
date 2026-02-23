import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Search, Loader2, Wrench, Truck, Settings,
  Calendar, MapPin, User, Package, Clock, ChevronDown,
  FileText, AlertTriangle, CheckCircle2, Image, Boxes,
  CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MediaPreviewModal } from "@/components/ui/media-preview-modal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  back_office_name?: string;
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
  offer_number?: string;
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

// ─── Sub-component: Articles checklist (mobile) ─────────────
function MobileArticlesChecklist({ workOrderId }: { workOrderId: string }) {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadArticles();
  }, [workOrderId]);

  const loadArticles = async () => {
    try {
      const { data, error } = await supabase
        .from("work_order_article_items")
        .select("*")
        .eq("work_order_id", workOrderId)
        .order("position", { ascending: true });
      if (error) throw error;
      setArticles(data || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const toggleComplete = async (article: any) => {
    const newCompleted = !article.is_completed;
    const { error } = await supabase
      .from("work_order_article_items")
      .update({ is_completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null })
      .eq("id", article.id);
    if (error) { toast.error("Errore"); return; }
    setArticles(prev => prev.map(a => a.id === article.id ? { ...a, is_completed: newCompleted } : a));
    toast.success(newCompleted ? "Completato ✓" : "Riaperto");
  };

  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />;
  if (articles.length === 0) return <p className="text-[11px] text-muted-foreground">Nessun articolo da assemblare</p>;

  const completed = articles.filter(a => a.is_completed).length;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          Da assemblare
        </p>
        <Badge variant="outline" className="text-[10px]">{completed}/{articles.length}</Badge>
      </div>
      {articles.map(article => (
        <button
          key={article.id}
          onClick={() => toggleComplete(article)}
          className="flex items-start gap-2 w-full text-left p-1.5 rounded-lg hover:bg-muted/50 active:bg-muted transition-colors"
        >
          <Checkbox checked={article.is_completed} className="mt-0.5 pointer-events-none" />
          <span className={`text-[12px] flex-1 whitespace-pre-wrap ${article.is_completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {article.description}
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Sub-component: Lead Photos ─────────────────────────────
function MobileLeadPhotos({ leadId }: { leadId: string }) {
  const [photos, setPhotos] = useState<Array<{ url: string; name: string; type: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [previewMedia, setPreviewMedia] = useState<{ url: string; name: string; isVideo: boolean } | null>(null);

  useEffect(() => {
    loadPhotos();
  }, [leadId]);

  const loadPhotos = async () => {
    try {
      const { data: leadFiles } = await supabase.from("lead_files").select("*").eq("lead_id", leadId);
      if (leadFiles) {
        const mediaFiles = leadFiles.filter(file =>
          file.file_type?.startsWith("image/") || file.file_type?.startsWith("video/") ||
          /\.(jpg|jpeg|png|gif|webp|bmp|mp4|mov|avi|webm|mkv)$/i.test(file.file_name)
        );
        setPhotos(mediaFiles.map(file => ({
          url: supabase.storage.from("lead-files").getPublicUrl(file.file_path).data.publicUrl,
          name: file.file_name,
          type: file.file_type || "",
        })));
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />;
  if (photos.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
        <Image className="h-3 w-3" /> Foto Cliente
      </p>
      <div className="grid grid-cols-4 gap-1.5">
        {photos.map((photo, index) => {
          const isVideo = /\.(mp4|mov|avi|webm|mkv|ogg)$/i.test(photo.name);
          return (
            <button
              key={index}
              onClick={() => setPreviewMedia({ url: photo.url, name: photo.name, isVideo })}
              className="relative rounded-lg overflow-hidden border border-border aspect-square"
            >
              {isVideo ? (
                <>
                  <video src={photo.url} className="w-full h-full object-cover" muted preload="metadata" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                </>
              ) : (
                <img src={photo.url} alt={photo.name} className="w-full h-full object-cover" />
              )}
            </button>
          );
        })}
      </div>
      <MediaPreviewModal
        open={!!previewMedia}
        onOpenChange={(open) => !open && setPreviewMedia(null)}
        url={previewMedia?.url || ""}
        name={previewMedia?.name || ""}
        isVideo={previewMedia?.isVideo || false}
      />
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────
export default function ZAppCommesse() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleCard = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

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
    onError: (err: any) => toast.error("Errore: " + err.message),
  });

  // ─── Data Fetching ──────────────────────────────────────
  const { data: workOrders = [], isLoading: loadingWO } = useQuery({
    queryKey: ["zapp-work-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select(`
          id, number, title, status, priority, scheduled_date, planned_start_date, planned_end_date,
          actual_start_date, actual_end_date, location, article, created_at, description, notes,
          diameter, smoke_inlet, includes_installation, payment_on_delivery, payment_amount, lead_id,
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
        lead_id: wo.lead_id,
        bom_name: wo.boms?.name, bom_version: wo.boms?.version,
        sales_order_number: wo.sales_orders?.number, offer_number: wo.offers?.number,
      }));
    },
  });

  const { data: serviceOrders = [], isLoading: loadingSWO } = useQuery({
    queryKey: ["zapp-service-work-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_work_orders")
        .select(`
          id, number, title, status, priority, scheduled_date, actual_start_date, actual_end_date,
          estimated_hours, actual_hours, location, article, created_at, description, notes,
          equipment_needed, lead_id,
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
        sales_order_number: so.sales_orders?.number,
      }));
    },
  });

  const { data: shippingOrders = [], isLoading: loadingSO } = useQuery({
    queryKey: ["zapp-shipping-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_orders")
        .select(`
          id, number, status, shipping_address, shipping_city, shipping_country,
          shipping_province, shipping_postal_code, article, created_at, notes,
          preparation_date, shipped_date, delivered_date, payment_on_delivery, payment_amount,
          assigned_to,
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
      }));
    },
  });

  const isLoading = loadingWO || loadingSWO || loadingSO;
  const allOrders = useMemo(() => [...workOrders, ...serviceOrders, ...shippingOrders], [workOrders, serviceOrders, shippingOrders]);
  const completedStatuses = ["completato", "spedito", "completed", "closed"];

  const filteredOrders = useMemo(() => {
    return allOrders.filter((o) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch = o.title.toLowerCase().includes(q) || o.number.toLowerCase().includes(q) ||
        (o.customer_name || "").toLowerCase().includes(q) || (o.article || "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" ||
        (statusFilter === "active" && !completedStatuses.includes(o.status)) ||
        (statusFilter === "completed" && completedStatuses.includes(o.status));
      return matchesSearch && matchesStatus;
    });
  }, [allOrders, searchTerm, statusFilter]);

  const ordersByType = (type: "produzione" | "servizio" | "spedizione" | "all") =>
    type === "all" ? filteredOrders : filteredOrders.filter((o) => o.type === type);

  const counts = {
    all: filteredOrders.length,
    produzione: ordersByType("produzione").length,
    servizio: ordersByType("servizio").length,
    spedizione: ordersByType("spedizione").length,
  };

  // ─── Helpers ────────────────────────────────────────────
  const fmtDate = (d?: string | null) => {
    if (!d) return null;
    try { return format(new Date(d), "dd MMM yyyy", { locale: it }); } catch { return d; }
  };
  const fmtDateTime = (d?: string | null) => {
    if (!d) return null;
    try { return format(new Date(d), "dd MMM yyyy, HH:mm", { locale: it }); } catch { return d; }
  };

  const DetailRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) => {
    if (!value) return null;
    return (
      <div className="flex items-start gap-2 text-[12px]">
        <span className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</span>
        <div><span className="text-muted-foreground">{label}: </span><span className="text-foreground font-medium">{value}</span></div>
      </div>
    );
  };

  const getStatusFlow = (type: string) =>
    type === "produzione" ? statusFlowProduzione : type === "servizio" ? statusFlowServizio : statusFlowSpedizione;

  // ─── Render Card ────────────────────────────────────────
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
          {/* Collapsed header */}
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
                    {order.customer_name && <span className="text-[10px] text-muted-foreground truncate">👤 {order.customer_name}</span>}
                  </div>
                </div>
              </div>
            </button>
          </CollapsibleTrigger>

          {/* Expanded content */}
          <CollapsibleContent>
            <div className="border-t border-border/50">
              {/* ── Status change ── */}
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
                        onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: order.id, type: order.type, newStatus: s.value }); }}
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

              {/* ── Details ── */}
              <div className="px-3 pb-3 pt-2 space-y-2">
                {/* Info generali */}
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Informazioni</p>
                  <DetailRow icon={<User className="h-3.5 w-3.5" />} label="Cliente" value={order.customer_name ? `${order.customer_name}${order.customer_code ? ` (${order.customer_code})` : ""}` : undefined} />
                  <DetailRow icon={<User className="h-3.5 w-3.5" />} label="Tecnico assegnato" value={order.assigned_to_name} />
                  <DetailRow icon={<User className="h-3.5 w-3.5" />} label="Back office" value={order.back_office_name} />
                  <DetailRow icon={<Package className="h-3.5 w-3.5" />} label="Articolo" value={order.article} />
                  <DetailRow icon={<FileText className="h-3.5 w-3.5" />} label="Descrizione" value={order.description} />
                </div>

                {/* Riferimenti */}
                {(order.sales_order_number || order.offer_number || order.bom_name) && (
                  <div className="space-y-1 pt-1 border-t border-border/30">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Riferimenti</p>
                    <DetailRow icon={<FileText className="h-3.5 w-3.5" />} label="Ordine" value={order.sales_order_number} />
                    <DetailRow icon={<FileText className="h-3.5 w-3.5" />} label="Offerta" value={order.offer_number} />
                    <DetailRow icon={<Boxes className="h-3.5 w-3.5" />} label="Distinta base" value={order.bom_name ? `${order.bom_name} (v${order.bom_version})` : undefined} />
                  </div>
                )}

                {/* Date */}
                <div className="space-y-1 pt-1 border-t border-border/30">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Date</p>
                  <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="Pianificata" value={fmtDate(order.scheduled_date)} />
                  <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="Inizio piano" value={fmtDate(order.planned_start_date)} />
                  <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="Fine piano" value={fmtDate(order.planned_end_date)} />
                  <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="Inizio effettivo" value={fmtDate(order.actual_start_date)} />
                  <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="Fine effettiva" value={fmtDate(order.actual_end_date)} />
                </div>

                {/* Location */}
                {order.location && (
                  <DetailRow icon={<MapPin className="h-3.5 w-3.5" />} label="Località" value={order.location} />
                )}

                {/* ── Produzione specifics ── */}
                {order.type === "produzione" && (
                  <>
                    {(order.diameter || order.smoke_inlet || order.includes_installation) && (
                      <div className="space-y-1 pt-1 border-t border-border/30">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Dettagli tecnici</p>
                        <DetailRow icon={<Settings className="h-3.5 w-3.5" />} label="Diametro" value={order.diameter} />
                        <DetailRow icon={<Settings className="h-3.5 w-3.5" />} label="Ingresso fumi" value={order.smoke_inlet} />
                        {order.includes_installation && (
                          <div className="flex items-center gap-2 text-[12px]">
                            <Wrench className="h-3.5 w-3.5 text-blue-500" />
                            <span className="text-blue-600 font-medium">Include installazione</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Articles checklist */}
                    <div className="pt-1 border-t border-border/30">
                      <MobileArticlesChecklist workOrderId={order.id} />
                    </div>

                    {/* Lead photos */}
                    {order.lead_id && (
                      <div className="pt-1 border-t border-border/30">
                        <MobileLeadPhotos leadId={order.lead_id} />
                      </div>
                    )}
                  </>
                )}

                {/* ── Servizio specifics ── */}
                {order.type === "servizio" && (
                  <>
                    {(order.equipment_needed || order.estimated_hours != null || order.actual_hours != null) && (
                      <div className="space-y-1 pt-1 border-t border-border/30">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Dettagli servizio</p>
                        <DetailRow icon={<Settings className="h-3.5 w-3.5" />} label="Attrezzatura" value={order.equipment_needed} />
                        {order.estimated_hours != null && <DetailRow icon={<Clock className="h-3.5 w-3.5" />} label="Ore stimate" value={`${order.estimated_hours}h`} />}
                        {order.actual_hours != null && <DetailRow icon={<Clock className="h-3.5 w-3.5" />} label="Ore effettive" value={`${order.actual_hours}h`} />}
                      </div>
                    )}
                    {order.lead_id && (
                      <div className="pt-1 border-t border-border/30">
                        <MobileLeadPhotos leadId={order.lead_id} />
                      </div>
                    )}
                  </>
                )}

                {/* ── Spedizione specifics ── */}
                {order.type === "spedizione" && (
                  <div className="space-y-1 pt-1 border-t border-border/30">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Dettagli spedizione</p>
                    <DetailRow icon={<MapPin className="h-3.5 w-3.5" />} label="Indirizzo" value={order.shipping_address} />
                    <DetailRow icon={<MapPin className="h-3.5 w-3.5" />} label="Città" value={[order.shipping_city, order.shipping_province].filter(Boolean).join(" ")} />
                    <DetailRow icon={<MapPin className="h-3.5 w-3.5" />} label="CAP" value={order.shipping_postal_code} />
                    <DetailRow icon={<MapPin className="h-3.5 w-3.5" />} label="Paese" value={order.shipping_country} />
                    <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="Preparazione" value={fmtDate(order.preparation_date)} />
                    <DetailRow icon={<Truck className="h-3.5 w-3.5" />} label="Spedito" value={fmtDate(order.shipped_date)} />
                    <DetailRow icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Consegnato" value={fmtDate(order.delivered_date)} />
                  </div>
                )}

                {/* Pagamento */}
                {order.payment_on_delivery && (
                  <div className="flex items-center gap-2 text-[12px] pt-1">
                    <CreditCard className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-amber-700 font-medium">
                      Pagamento alla consegna{order.payment_amount ? `: €${order.payment_amount.toLocaleString("it-IT")}` : ""}
                    </span>
                  </div>
                )}

                {/* Notes */}
                {order.notes && (
                  <div className="pt-1 border-t border-border/30">
                    <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Note</p>
                    <p className="text-[12px] text-foreground whitespace-pre-wrap bg-muted/50 p-2 rounded-lg">{order.notes}</p>
                  </div>
                )}

                {/* Meta */}
                <div className="pt-2 border-t border-border/30">
                  <DetailRow icon={<Clock className="h-3.5 w-3.5" />} label="Creata il" value={fmtDateTime(order.created_at)} />
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  };

  // ─── Page Layout ────────────────────────────────────────
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

      {/* Search + filters */}
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

      {/* Tabs */}
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
