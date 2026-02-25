import { useState, useMemo, useEffect, useCallback, memo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Search, Loader2, Wrench, Truck, Settings,
  Calendar, MapPin, User, Package, Clock, ChevronDown,
  FileText, AlertTriangle, CheckCircle2, Image, Boxes,
  CreditCard, ChevronRight, Building2, CalendarPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MediaPreviewModal } from "@/components/ui/media-preview-modal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
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
  // Overall progress indicator
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

const completedStatuses = ["completato", "spedito", "completed", "closed"];

// ─── Sub-component: Articles checklist (mobile) ─────────────
const MobileArticlesChecklist = memo(function MobileArticlesChecklist({ workOrderId }: { workOrderId: string }) {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadArticles(); }, [workOrderId]);

  const loadArticles = async () => {
    try {
      const { data, error } = await supabase
        .from("work_order_article_items")
        .select("*")
        .eq("work_order_id", workOrderId)
        .order("position", { ascending: true });
      if (error) throw error;
      setArticles(data || []);
    } catch { /* silent */ } finally { setLoading(false); }
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
  if (articles.length === 0) return <p className="text-[11px] text-muted-foreground">Nessun articolo</p>;

  const completed = articles.filter(a => a.is_completed).length;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Da assemblare</p>
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
});

// ─── Sub-component: Lead Photos ─────────────────────────────
const MobileLeadPhotos = memo(function MobileLeadPhotos({ leadId }: { leadId: string }) {
  const [photos, setPhotos] = useState<Array<{ url: string; name: string; type: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [previewMedia, setPreviewMedia] = useState<{ url: string; name: string; isVideo: boolean } | null>(null);

  useEffect(() => { loadPhotos(); }, [leadId]);

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
});

// ─── Phase Progress Indicator ─────────────────────────────────
const PhasePipeline = memo(function PhasePipeline({ group }: { group: CustomerGroup }) {
  const phases = [
    { key: "produzione" as const, orders: group.production },
    { key: "spedizione" as const, orders: group.shipping },
    { key: "servizio" as const, orders: group.service },
  ];

  return (
    <div className="flex items-center gap-0 px-1">
      {phases.map((phase, idx) => {
        const config = phaseConfig[phase.key];
        const Icon = config.icon;
        const hasOrders = phase.orders.length > 0;
        const allDone = hasOrders && phase.orders.every(o => completedStatuses.includes(o.status));
        const someInProgress = hasOrders && phase.orders.some(o => !completedStatuses.includes(o.status) && o.status !== "da_fare" && o.status !== "da_preparare");

        return (
          <div key={phase.key} className="flex items-center">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${
              allDone ? "bg-green-100 text-green-700" :
              someInProgress ? `${config.lightBg} ${config.text}` :
              hasOrders ? "bg-muted text-muted-foreground" :
              "bg-muted/50 text-muted-foreground/40"
            }`}>
              {allDone ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <Icon className="h-3 w-3" />
              )}
              <span className="hidden sm:inline">{config.label}</span>
              {hasOrders && <span>({phase.orders.length})</span>}
            </div>
            {idx < 2 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground/40 mx-0.5 flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
});

// ─── Phase Order Card (compact) ──────────────────────────────
const PhaseOrderCard = memo(function PhaseOrderCard({ order, onStatusChange, isPending, onSchedule }: {
  order: UnifiedOrder;
  onStatusChange: (id: string, type: string, newStatus: string) => void;
  onSchedule: (order: UnifiedOrder) => void;
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
    try { return format(new Date(d), "dd MMM", { locale: it }); } catch { return d; }
  };

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className={`rounded-lg border ${config.border} overflow-hidden bg-background`}>
        <CollapsibleTrigger asChild>
          <button className="w-full text-left p-2.5 active:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              <div className={`h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0 ${config.lightBg}`}>
                <Icon className={`h-3.5 w-3.5 ${config.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-medium truncate">{order.title}</span>
                  {priorityInfo?.icon && <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-muted-foreground font-mono">{order.number}</span>
                  {order.scheduled_date && (
                    <span className="text-[10px] text-muted-foreground">• {fmtDate(order.scheduled_date)}</span>
                  )}
                  {order.assigned_to_name && (
                    <span className="text-[10px] text-muted-foreground">• {order.assigned_to_name}</span>
                  )}
                </div>
              </div>
              <Badge className={`${statusInfo.color} text-[9px] px-1.5 border flex-shrink-0`}>{statusInfo.label}</Badge>
              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`} />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border/50 px-2.5 py-2.5 space-y-2.5">
            {/* Schedule button */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Calendario</p>
                {order.scheduled_date ? (
                  <p className="text-[11px] text-foreground">{fmtDate(order.scheduled_date)}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Non calendarizzato</p>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onSchedule(order); }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 active:scale-95 transition-all"
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                {order.scheduled_date ? "Modifica" : "Calendarizza"}
              </button>
            </div>

            {/* Status change */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Cambia stato</p>
              <div className="flex flex-wrap gap-1">
                {statusFlow.map(s => {
                  const isActive = order.status === s.value;
                  const si = statusLabels[s.value];
                  return (
                    <button
                      key={s.value}
                      disabled={isActive || isPending}
                      onClick={(e) => { e.stopPropagation(); onStatusChange(order.id, order.type, s.value); }}
                      className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-all ${
                        isActive
                          ? `${si?.color || "bg-muted"} border-current ring-1 ring-offset-1 ring-current/20`
                          : "bg-background border-border text-muted-foreground hover:bg-muted/50 active:scale-95"
                      }`}
                    >
                      {isActive && <CheckCircle2 className="h-2.5 w-2.5 inline mr-0.5 -mt-0.5" />}
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
                  <div className="space-y-1 text-[11px]">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Tecnico</p>
                    {order.diameter && <p><span className="text-muted-foreground">Diametro:</span> {order.diameter}</p>}
                    {order.smoke_inlet && <p><span className="text-muted-foreground">Fumi:</span> {order.smoke_inlet}</p>}
                    {order.includes_installation && (
                      <p className="text-blue-600 font-medium flex items-center gap-1"><Wrench className="h-3 w-3" /> Include installazione</p>
                    )}
                  </div>
                )}
                {order.bom_name && (
                  <p className="text-[11px]"><span className="text-muted-foreground">BOM:</span> {order.bom_name} (v{order.bom_version})</p>
                )}
                <MobileArticlesChecklist workOrderId={order.id} />
                {order.lead_id && <MobileLeadPhotos leadId={order.lead_id} />}
              </>
            )}

            {order.type === "spedizione" && (
              <div className="space-y-1 text-[11px]">
                {order.shipping_address && (
                  <p className="flex items-start gap-1.5">
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
              <>
                <div className="space-y-1 text-[11px]">
                  {order.equipment_needed && <p><span className="text-muted-foreground">Attrezzatura:</span> {order.equipment_needed}</p>}
                  {order.estimated_hours != null && <p><span className="text-muted-foreground">Ore stimate:</span> {order.estimated_hours}h</p>}
                  {order.actual_hours != null && <p><span className="text-muted-foreground">Ore effettive:</span> {order.actual_hours}h</p>}
                </div>
                {order.lead_id && <MobileLeadPhotos leadId={order.lead_id} />}
              </>
            )}

            {/* Payment */}
            {order.payment_on_delivery && (
              <div className="flex items-center gap-1.5 text-[11px] text-amber-700 font-medium">
                <CreditCard className="h-3 w-3" />
                Pagamento alla consegna{order.payment_amount ? `: €${order.payment_amount.toLocaleString("it-IT")}` : ""}
              </div>
            )}

            {/* Notes */}
            {order.notes && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Note</p>
                <p className="text-[11px] text-foreground whitespace-pre-wrap bg-muted/50 p-2 rounded-md">{order.notes}</p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
});

// ─── Customer Group Card ─────────────────────────────────────
const CustomerGroupCard = memo(function CustomerGroupCard({ group, onStatusChange, onSchedule, isPending }: {
  group: CustomerGroup;
  onStatusChange: (id: string, type: string, newStatus: string) => void;
  onSchedule: (order: UnifiedOrder) => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const totalOrders = group.production.length + group.shipping.length + group.service.length;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="bg-background rounded-xl shadow-sm border border-border overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full text-left p-3 active:bg-muted/30 transition-colors">
            <div className="flex items-start gap-2.5">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted">
                <Building2 className="h-4 w-4 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="font-semibold text-[14px] truncate flex-1">
                    {group.customerName}
                  </p>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`} />
                </div>
                {group.customerCode && (
                  <p className="text-[10px] text-muted-foreground mb-1.5">Cod. {group.customerCode}</p>
                )}
                <PhasePipeline group={group} />
              </div>
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border/50 p-3 space-y-3">
            {/* Production phase */}
            {group.production.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <div className={`h-1.5 w-1.5 rounded-full ${phaseConfig.produzione.color}`} />
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Produzione ({group.production.length})
                  </p>
                </div>
                <div className="space-y-1.5">
                  {group.production.map(o => (
                    <PhaseOrderCard key={o.id} order={o} onStatusChange={onStatusChange} onSchedule={onSchedule} isPending={isPending} />
                  ))}
                </div>
              </div>
            )}

            {/* Shipping phase */}
            {group.shipping.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <div className={`h-1.5 w-1.5 rounded-full ${phaseConfig.spedizione.color}`} />
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Spedizione ({group.shipping.length})
                  </p>
                </div>
                <div className="space-y-1.5">
                  {group.shipping.map(o => (
                    <PhaseOrderCard key={o.id} order={o} onStatusChange={onStatusChange} onSchedule={onSchedule} isPending={isPending} />
                  ))}
                </div>
              </div>
            )}

            {/* Service/Installation phase */}
            {group.service.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <div className={`h-1.5 w-1.5 rounded-full ${phaseConfig.servizio.color}`} />
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Installazione ({group.service.length})
                  </p>
                </div>
                <div className="space-y-1.5">
                  {group.service.map(o => (
                    <PhaseOrderCard key={o.id} order={o} onStatusChange={onStatusChange} onSchedule={onSchedule} isPending={isPending} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
});

// ─── Main Component ─────────────────────────────────────────
export default function ZAppCommesse() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [scheduleOrder, setScheduleOrder] = useState<UnifiedOrder | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(value), 250);
  }, []);

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

  const handleStatusChange = useCallback((id: string, type: string, newStatus: string) => {
    updateStatus.mutate({ id, type, newStatus });
  }, [updateStatus]);

  const handleOpenSchedule = useCallback((order: UnifiedOrder) => {
    setScheduleOrder(order);
    setScheduleDate(order.scheduled_date ? new Date(order.scheduled_date) : undefined);
  }, []);

  const scheduleOrderMutation = useMutation({
    mutationFn: async ({ id, type, date }: { id: string; type: string; date: string }) => {
      const table = type === "produzione" ? "work_orders" : type === "servizio" ? "service_work_orders" : "shipping_orders";
      const field = type === "spedizione" ? "order_date" : "scheduled_date";
      const { error } = await supabase.from(table).update({ [field]: date }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Commessa calendarizzata");
      queryClient.invalidateQueries({ queryKey: ["zapp-work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["zapp-service-work-orders"] });
      queryClient.invalidateQueries({ queryKey: ["zapp-shipping-orders"] });
      setScheduleOrder(null);
    },
    onError: (err: any) => toast.error("Errore: " + err.message),
  });

  const handleConfirmSchedule = useCallback(() => {
    if (!scheduleOrder || !scheduleDate) return;
    scheduleOrderMutation.mutate({
      id: scheduleOrder.id,
      type: scheduleOrder.type,
      date: format(scheduleDate, "yyyy-MM-dd"),
    });
  }, [scheduleOrder, scheduleDate, scheduleOrderMutation]);

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
    staleTime: 30_000,
  });

  const { data: serviceOrders = [], isLoading: loadingSWO } = useQuery({
    queryKey: ["zapp-service-work-orders"],
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
    staleTime: 30_000,
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
    staleTime: 30_000,
  });

  const isLoading = loadingWO || loadingSWO || loadingSO;
  const allOrders = useMemo(() => [...workOrders, ...serviceOrders, ...shippingOrders], [workOrders, serviceOrders, shippingOrders]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    return allOrders.filter((o) => {
      const q = debouncedSearch.toLowerCase();
      const matchesSearch = !q || o.title.toLowerCase().includes(q) || o.number.toLowerCase().includes(q) ||
        (o.customer_name || "").toLowerCase().includes(q) || (o.article || "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" ||
        (statusFilter === "active" && !completedStatuses.includes(o.status)) ||
        (statusFilter === "completed" && completedStatuses.includes(o.status));
      return matchesSearch && matchesStatus;
    });
  }, [allOrders, debouncedSearch, statusFilter]);

  // Group by customer
  const customerGroups = useMemo((): CustomerGroup[] => {
    const groupMap = new Map<string, CustomerGroup>();

    filteredOrders.forEach(order => {
      // Group by customer name, fallback to sales_order_id, fallback to order id
      const key = order.customer_name || order.sales_order_id || order.id;
      
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key,
          customerName: order.customer_name || order.title,
          customerCode: order.customer_code,
          production: [],
          shipping: [],
          service: [],
          phases: { produzione: "", spedizione: "", servizio: "" },
        });
      }

      const group = groupMap.get(key)!;
      if (!group.customerCode && order.customer_code) group.customerCode = order.customer_code;

      if (order.type === "produzione") group.production.push(order);
      else if (order.type === "spedizione") group.shipping.push(order);
      else if (order.type === "servizio") group.service.push(order);
    });

    // Sort: groups with active work first, then by customer name
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
            <p className="text-purple-100 text-xs">{totalCustomers} clienti · {totalOrders} commesse</p>
          </div>
        </div>
      </div>

      {/* Search + filters */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cerca cliente, commessa..." value={searchTerm} onChange={(e) => handleSearchChange(e.target.value)} className="pl-9 rounded-xl bg-background" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[110px] rounded-xl bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Attive</SelectItem>
              <SelectItem value="completed">Completate</SelectItem>
              <SelectItem value="all">Tutte</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Phase legend */}
        <div className="flex gap-3 flex-wrap">
          {(["produzione", "spedizione", "servizio"] as const).map(phase => {
            const c = phaseConfig[phase];
            return (
              <div key={phase} className={`flex items-center gap-1.5 text-[11px] ${c.text} font-medium`}>
                <div className={`h-2.5 w-2.5 rounded-full ${c.color}`} />
                {c.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Customer groups */}
      <div className="px-4 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : customerGroups.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Nessuna commessa trovata</div>
        ) : (
          customerGroups.map(group => (
            <CustomerGroupCard
              key={group.key}
              group={group}
              onStatusChange={handleStatusChange}
              onSchedule={handleOpenSchedule}
              isPending={updateStatus.isPending}
            />
          ))
        )}
      </div>

      {/* Schedule Dialog */}
      <Dialog open={!!scheduleOrder} onOpenChange={(o) => !o && setScheduleOrder(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Calendarizza Commessa</DialogTitle>
          </DialogHeader>
          {scheduleOrder && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {scheduleOrder.title} — <span className="font-mono">{scheduleOrder.number}</span>
              </p>
              <div>
                <Label className="text-xs">Seleziona data</Label>
                <CalendarPicker
                  mode="single"
                  selected={scheduleDate}
                  onSelect={setScheduleDate}
                  locale={it}
                  className="rounded-md border mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleOrder(null)}>Annulla</Button>
            <Button onClick={handleConfirmSchedule} disabled={!scheduleDate || scheduleOrderMutation.isPending}>
              {scheduleOrderMutation.isPending ? "Salvataggio..." : "Conferma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
